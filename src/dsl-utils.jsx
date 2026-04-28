/**
 * DSL Utilities - Create graphs from configuration
 */

import { parseDSL } from './parser.jsx'
import { resolveGraph } from './graph.jsx'

/**
 * Create a graph from a configuration object
 * Supports multiple input formats:
 * - DSL string
 * - Graph object
 * - URL to DSL
 */
export async function createGraphFromConfig(config, options = {}) {
  if (!config) {
    throw new Error('No configuration provided')
  }

  let graph = null

  // Case 1: DSL string
  if (typeof config === 'string') {
    try {
      graph = parseDSL(config)
    } catch (e) {
      // Maybe it's JSON?
      try {
        graph = JSON.parse(config)
      } catch (e2) {
        throw new Error('Failed to parse configuration: not valid DSL or JSON')
      }
    }
  }
  // Case 2: URL
  else if (typeof config === 'object' && config.url) {
    const response = await fetch(config.url)
    const text = await response.text()
    try {
      graph = parseDSL(text)
    } catch (e) {
      graph = JSON.parse(text)
    }
  }
  // Case 3: Graph object
  else if (typeof config === 'object') {
    graph = config
  }

  if (!graph) {
    throw new Error('Could not create graph from configuration')
  }

  // Auto-resolve unless disabled
  if (options.resolve !== false) {
    graph = resolveGraph(graph)
  }

  return graph
}

/**
 * Template literals for creating DSL
 * Usage: dsl`nodes: ...`
 */
export function dsl(strings, ...values) {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    result += values[i] + strings[i + 1]
  }
  return result
}

/**
 * Predefined graph templates
 */
export const templates = {
  microservices: {
    code: `# Microservices
nodes:
  - id: client type: actor label: "Client"
  - id: api type: gateway label: "API Gateway"
  - id: svc1 type: service label: "Service A"
  - id: svc2 type: service label: "Service B"
  - id: db type: store label: "Database"
edges:
  - client -> api label: "Request"
  - api -> svc1 label: "Route"
  - api -> svc2 label: "Route"
  - svc1 -> db label: "Query"
  - svc2 -> db label: "Query"
`,
    description: 'Basic microservices architecture'
  },

  eventDriven: {
    code: `# Event-Driven Architecture
nodes:
  - id: producer type: service label: "Producer"
  - id: broker type: queue label: "Message Broker"
  - id: consumer1 type: service label: "Consumer A"
  - id: consumer2 type: service label: "Consumer B"
edges:
  - producer -> broker label: "Publish"
  - broker -> consumer1 label: "Subscribe"
  - broker -> consumer2 label: "Subscribe"
`,
    description: 'Event-driven system with message broker'
  },

  cqrs: {
    code: `# CQRS Pattern
nodes:
  - id: client type: actor label: "Client"
  - id: api type: gateway label: "API"
  - id: command type: service label: "Command Handler"
  - id: query type: service label: "Query Handler"
  - id: writeDb type: store label: "Write DB"
  - id: readDb type: store label: "Read DB"
edges:
  - client -> api label: "Request"
  - api -> command label: "Command"
  - api -> query label: "Query"
  - command -> writeDb label: "Write"
  - writeDb -> readDb label: "Sync"
  - query -> readDb label: "Read"
`,
    description: 'CQRS pattern with separate read/write models'
  }
}

export default {
  createGraphFromConfig,
  dsl,
  templates
}
