import glob

auth_dir = '/Users/xuanguyen/Workspaces/react-starter-kit/src/apps/(default)/views'
css_files = glob.glob(f"{auth_dir}/**/*.css", recursive=True)

for filepath in css_files:
    if 'Login.css' in filepath or 'Register.css' in filepath or 'ResetPassword' in filepath or 'EmailVerification.css' in filepath:
        with open(filepath, 'r') as f:
            content = f.read()
            
        if '.contentWrapper {' in content and 'background-color:' not in content.split('.contentWrapper {')[1].split('}')[0]:
            # Add background color
            new_content = content.replace(
                '.contentWrapper {\n  flex: 1;',
                '.contentWrapper {\n  flex: 1;\n  background-color: var(--color-panel-solid);'
            )
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Patched {filepath}")

