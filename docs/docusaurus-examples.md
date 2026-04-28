/**
 * Documentation Examples for Docusaurus/MDX
 */

import Layout from '@theme/Layout'
import BrowserOnly from '@docusaurus/BrowserOnly'
import { FlowDiagram } from 'flow-diagram'

// Example MDX component for embedding diagrams
export const FlowDiagramMDX = ({ dsl, config, style = 'sleek', height = '400px' }) => {
  return (
    <div style={{ margin: '2rem 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eaeaea' }}>
      <BrowserOnly>
        {() => (
          <FlowDiagram
            dsl={dsl}
            config={config}
            style={style}
            animate={false}
            padding={20}
          />
        )}
      </BrowserOnly>
    </div>
  )
}

// Common diagram examples for docs
export const examples = {
  microservices: `# Microservices
nodes:
  - id: client type: actor label: "Client"
  - id: api type: gateway label: "API Gateway"
  - id: orders type: service label: "Orders"
  - id: db type: store label: "Database"

edges:
  - client -> api label: "Request"
  - api -> orders label: "Route"
  - orders -> db label: "Query"
`,

  eventDriven: `# Event-Driven
nodes:
  - id: producer type: service label: "Producer"
  - id: queue type: queue label: "Message Queue"
  - id: consumer type: service label: "Consumer"

edges:
  - producer -> queue label: "Publish"
  - queue -> consumer label: "Consume"
`,

  cqrs: `# CQRS Pattern
nodes:
  - id: client type: actor label: "Client"
  - id: write type: service label: "Command Handler"
  - id: read type: service label: "Query Handler"
  - id: writeDb type: store label: "Write DB"
  - id: readDb type: store label: "Read DB"

edges:
  - client -> write label: "Command"
  - client -> read label: "Query"
  - write -> writeDb label: "Update"
  - read -> readDb label: "Read"
  - writeDb -> readDb label: "Sync"
`
}

// Docusaurus plugin configuration
export const docusaurusConfig = {
  themeConfig: {
    flowDiagram: {
      defaultStyle: 'sleek',
      animate: false,
      padding: 20,
      height: '400px'
    }
  }
}

export default FlowDiagramMDX
