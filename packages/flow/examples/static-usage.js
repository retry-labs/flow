/**
 * Static Website Example
 * Shows how to use @retry-labs/flow without any build tools
 */

// Example 1: Simple script tag usage
const staticExampleHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@retry-labs/flow - Static Example</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/@retry-labs/flow/dist/flow.umd.js"></script>
</head>
<body>
  <div id="root"></div>
  
  <script type="text/babel">
    const { RLFlow } = window.RLFlow;
    
    const App = () => {
      const dslConfig = \`# My System
nodes:
  - id: client type: actor label: "Client"
  - id: api type: gateway label: "API Gateway"
  - id: service type: service label: "Service"
  - id: db type: store label: "Database"

edges:
  - client -> api label: "Request"
  - api -> service label: "Route"
  - service -> db label: "Query"
\`;

      return React.createElement(RLFlow, {
        dsl: dslConfig,
        style: "sleek",
        animate: true,
        padding: 20
      });
    };

    ReactDOM.createRoot(document.getElementById('root')).createElement(App());
  </script>
</body>
</html>
`;

// Example 2: Pure JavaScript (no framework)
const vanillaExample = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@retry-labs/flow - Vanilla JS</title>
  <script src="https://unpkg.com/@retry-labs/flow/dist/flow.umd.js"></script>
</head>
<body>
  <div id="diagram-container"></div>
  
  <script>
    // Use the @retry-labs/flow library
    const { Diagram } = window.RLFlow;
    
    const graphConfig = {
      nodes: [
        { id: 'client', kind: 'actor', label: 'Client', x: 50, y: 100, w: 100, h: 60 },
        { id: 'server', kind: 'service', label: 'Server', x: 250, y: 100, w: 120, h: 60 },
        { id: 'db', kind: 'store', label: 'Database', x: 450, y: 100, w: 100, h: 70 }
      ],
      edges: [
        { id: 'e1', from: 'client', to: 'server', kind: 'solid', label: 'Request' },
        { id: 'e2', from: 'server', to: 'db', kind: 'solid', label: 'Query' }
      ]
    };
    
    // Render using canvas/SVG directly
    // Or use with React if available
    console.log('RLFlow loaded', window.RLFlow);
  </script>
</body>
</html>
`;

// Example 3: Markdown/Confluence integration
const confluenceExample = `
<h1>System Architecture</h1>

<p>Here's how our microservices communicate:</p>

<ac:structured-macro ac:name="html">
  <ac:plain-text-body>
    <![CDATA[
      <div id="rl-flow-embed"></div>
      <script src="https://unpkg.com/@retry-labs/flow/dist/flow.umd.js"></script>
      <script>
        const { Diagram } = window.RLFlow;
        // Embed diagram here
      </script>
    ]]>
  </ac:plain-text-body>
</ac:structured-macro>

<h2>Request Flow</h2>

<p>The following diagram shows the request flow:</p>

<div data-rl-flow='{"nodes": [{"id": "client", "kind": "actor", "label": "Client"}, {"id": "api", "kind": "gateway", "label": "API"}, {"id": "db", "kind": "store", "label": "Database"}], "edges": [{"from": "client", "to": "api"}, {"from": "api", "to": "db"}]}'></div>
`;

export { staticExampleHTML, vanillaExample, confluenceExample };
