#!/usr/bin/env node
/**
 * Helper for running LibreOffice (soffice) in environments where AF_UNIX
 * sockets may be blocked (e.g., sandboxed VMs). Detects the restriction
 * at runtime and applies an LD_PRELOAD shim if needed.
 *
 * Usage:
 *     const { runSoffice, getSofficeEnv } = require('./soffice');
 *
 *     // Option 1 – run soffice directly
 *     const result = runSoffice(["--headless", "--convert-to", "pdf", "input.docx"]);
 *
 *     // Option 2 – get env dict for your own subprocess calls
 *     const env = getSofficeEnv();
 *     spawnSync("soffice", [...], { env });
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

function getSofficeBin() {
    const system = os.platform();
    let paths = [];
    if (system === "win32") {
        paths = [
            "soffice.exe",
            "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
            "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
        ];
    } else if (system === "darwin") {
        paths = ["soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"];
    } else {
        paths = ["soffice"];
    }

    const whichCmd = system === 'win32' ? 'where' : 'which';

    for (const p of paths) {
        try {
            const out = execSync(`${whichCmd} "${p}"`, { stdio: 'pipe' }).toString().trim();
            if (out) return out.split('\n')[0].trim();
        } catch (e) {
            if (path.isAbsolute(p) && fs.existsSync(p)) {
                try {
                    fs.accessSync(p, fs.constants.X_OK);
                    return p;
                } catch (err) {}
            }
        }
    }
    return "soffice";
}

const SHIM_SO = path.join(os.tmpdir(), "lo_socket_shim.so");

function _needsShim() {
    if (os.platform() === "win32") return false;
    
    const testPath = path.join(os.tmpdir(), `_lo_test_${Date.now()}_${Math.floor(Math.random()*1000)}.sock`);
    try {
        const code = `
            const net = require('net');
            const s = net.createServer();
            s.on('error', () => process.exit(1));
            s.listen(process.argv[1], () => {
                s.close();
                process.exit(0);
            });
        `;
        const result = spawnSync(process.execPath, ['-e', code, testPath], { stdio: 'pipe' });
        if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
        return result.status !== 0;
    } catch (e) {
        return true;
    }
}

const _SHIM_SOURCE = `
#define _GNU_SOURCE
#include <sys/socket.h>
#include <sys/un.h>
#include <dlfcn.h>
#include <unistd.h>
#include <errno.h>
#include <stdlib.h>

static int (*real_socket)(int, int, int);
static int (*real_socketpair)(int, int, int, int[2]);
static int (*real_listen)(int, int);
static int (*real_accept)(int, struct sockaddr *, socklen_t *);
static int (*real_close)(int);
static ssize_t (*real_read)(int, void *, size_t);

/* Per-FD bookkeeping (FDs >= 1024 are passed through unshimmed). */
static int is_shimmed[1024];
static int peer_of[1024];
static int wake_r[1024];            /* accept() blocks reading this */
static int wake_w[1024];            /* close()  writes to this      */
static int listener_fd = -1;        /* FD that received listen()    */

__attribute__((constructor))
static void init(void) {
    real_socket     = dlsym(RTLD_NEXT, "socket");
    real_socketpair = dlsym(RTLD_NEXT, "socketpair");
    real_listen     = dlsym(RTLD_NEXT, "listen");
    real_accept     = dlsym(RTLD_NEXT, "accept");
    real_close      = dlsym(RTLD_NEXT, "close");
    real_read       = dlsym(RTLD_NEXT, "read");
    for (int i = 0; i < 1024; i++) {
        peer_of[i] = -1;
        wake_r[i]  = -1;
        wake_w[i]  = -1;
    }
}

/* ---- socket ---------------------------------------------------------- */
int socket(int domain, int type, int protocol) {
    if (domain == AF_UNIX) {
        int fd = real_socket(domain, type, protocol);
        if (fd >= 0) return fd;
        /* socket(AF_UNIX) blocked – fall back to socketpair(). */
        int sv[2];
        if (real_socketpair(domain, type, protocol, sv) == 0) {
            if (sv[0] >= 0 && sv[0] < 1024) {
                is_shimmed[sv[0]] = 1;
                peer_of[sv[0]]    = sv[1];
                int wp[2];
                if (pipe(wp) == 0) {
                    wake_r[sv[0]] = wp[0];
                    wake_w[sv[0]] = wp[1];
                }
            }
            return sv[0];
        }
        errno = EPERM;
        return -1;
    }
    return real_socket(domain, type, protocol);
}

/* ---- listen ---------------------------------------------------------- */
int listen(int sockfd, int backlog) {
    if (sockfd >= 0 && sockfd < 1024 && is_shimmed[sockfd]) {
        listener_fd = sockfd;
        return 0;
    }
    return real_listen(sockfd, backlog);
}

/* ---- accept ---------------------------------------------------------- */
int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen) {
    if (sockfd >= 0 && sockfd < 1024 && is_shimmed[sockfd]) {
        /* Block until close() writes to the wake pipe. */
        if (wake_r[sockfd] >= 0) {
            char buf;
            real_read(wake_r[sockfd], &buf, 1);
        }
        errno = ECONNABORTED;
        return -1;
    }
    return real_accept(sockfd, addr, addrlen);
}

/* ---- close ----------------------------------------------------------- */
int close(int fd) {
    if (fd >= 0 && fd < 1024 && is_shimmed[fd]) {
        int was_listener = (fd == listener_fd);
        is_shimmed[fd] = 0;

        if (wake_w[fd] >= 0) {              /* unblock accept() */
            char c = 0;
            write(wake_w[fd], &c, 1);
            real_close(wake_w[fd]);
            wake_w[fd] = -1;
        }
        if (wake_r[fd] >= 0) { real_close(wake_r[fd]); wake_r[fd]  = -1; }
        if (peer_of[fd] >= 0) { real_close(peer_of[fd]); peer_of[fd] = -1; }

        if (was_listener)
            _exit(0);                        /* conversion done – exit */
    }
    return real_close(fd);
}
`;

function _ensureShim() {
    if (fs.existsSync(SHIM_SO)) return SHIM_SO;

    const src = path.join(os.tmpdir(), "lo_socket_shim.c");
    fs.writeFileSync(src, _SHIM_SOURCE);
    try {
        // gcc requires shell/command-line parsing, but we control the string and variables here.
        execSync(`gcc -shared -fPIC -o "${SHIM_SO}" "${src}" -ldl`, { stdio: 'pipe' });
    } catch (e) {
        console.error("Failed to compile shim logic.", e.message);
    } finally {
        if (fs.existsSync(src)) {
            fs.unlinkSync(src);
        }
    }
    return fs.existsSync(SHIM_SO) ? SHIM_SO : '';
}

function getSofficeEnv() {
    const env = Object.assign({}, process.env);
    env["SAL_USE_VCLPLUGIN"] = "svp";

    if (_needsShim()) {
        const shim = _ensureShim();
        if (shim) {
            env["LD_PRELOAD"] = shim;
        }
    }
    return env;
}

function runSoffice(args, kwargs = {}) {
    const env = getSofficeEnv();
    const bin = getSofficeBin();
    return spawnSync(bin, args, { env, stdio: 'inherit', ...kwargs });
}

module.exports = {
    getSofficeEnv,
    getSofficeBin,
    runSoffice
};

if (require.main === module) {
    const args = process.argv.slice(2);
    const result = runSoffice(args);
    if (result.error) {
        console.error(result.error);
        process.exit(1);
    }
    process.exit(result.status || 0);
}
