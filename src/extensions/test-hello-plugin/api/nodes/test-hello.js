export function getNodeJS() {
  return `module.exports = function(RED) {
    function TestHelloNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;

      node.on('input', async function (msg, send, done) {
        try {
          // Access global context
          const globalContext = node.context().global;
          const container = globalContext.get('container');

          if (!container) {
            throw new Error(
              'xnapify DI container is not available in global context',
            );
          }

          // Resolve models and query DB
          const models = container().resolve('models');
          const users = await models.User.findAll();

          // Get OS info via Node.js native module or global context
          const os = globalContext.get('os') || require('os');

          // Attach response to payload
          msg.payload = msg.payload || {};
          msg.payload.os_platform = os.platform();
          msg.payload.models = Object.keys(models);
          msg.payload.users = users;
          msg.payload.message =
            'Hello from Node-RED test-hello Extension Node!';

          if (send) {
            send([msg, null]);
          } else {
            node.send([msg, null]);
          }
          if (done) done();
        } catch (err) {
          msg.error = err.message;
          if (send) {
            send([null, msg]);
          } else {
            node.send([null, msg]);
          }
          if (done) done(err);
        }
      });
    }

    RED.nodes.registerType('test-hello', TestHelloNode);
  };`;
}

export function getNodeHTML() {
  return `
<script type="text/javascript">
  RED.nodes.registerType('test-hello', {
    category: 'xnapify',
    color: '#a6bbcf',
    defaults: {
      name: { value: "" }
    },
    inputs: 1,
    outputs: 2,
    outputLabels: ["Success", "Error"],
    icon: "font-awesome/fa-smile-o",
    label: function() {
      return this.name || "test-hello";
    }
  });
</script>

<script type="text/html" data-template-name="test-hello">
  <div class="form-row">
    <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
    <input type="text" id="node-input-name" placeholder="Name">
  </div>
</script>

<script type="text/html" data-help-name="test-hello">
  <p>A custom node created via the xnapify extension system.</p>
  <p>It fetches data from the xnapify DB and OS platform details, simulating the previous test-hello-flow.</p>
  <h3>Outputs</h3>
  <ol class="node-ports">
      <li>Success
          <dl class="message-properties">
              <dt>payload.os_platform <span class="property-type">string</span></dt>
              <dt>payload.models <span class="property-type">array</span></dt>
              <dt>payload.users <span class="property-type">array</span></dt>
          </dl>
      </li>
      <li>Error
          <dl class="message-properties">
              <dt>error <span class="property-type">string</span></dt>
          </dl>
      </li>
  </ol>
</script>
`;
}
