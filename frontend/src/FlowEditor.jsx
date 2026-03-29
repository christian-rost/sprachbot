import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

// Design tokens matching the admin panel
const C = {
  primary: "#ee7f00",
  sidebar: "#213452",
  bg: "#f5f7fa",
  surface: "#ffffff",
  border: "#e0e0e0",
  text: "#111827",
  muted: "#6b7280",
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  purple: "#8b5cf6",
}

// Node type colors and icons
const NODE_META = {
  start:     { color: C.success,  icon: "▶",  label: "Start" },
  slot:      { color: C.primary,  icon: "✏️",  label: "Slot" },
  dialog:    { color: C.info,     icon: "💬", label: "Dialog" },
  condition: { color: C.warning,  icon: "◆",  label: "Bedingung" },
  webhook:   { color: C.purple,   icon: "🔗", label: "Webhook" },
  end:       { color: C.sidebar,  icon: "⏹",  label: "Ende" },
}

const PALETTE_NODES = [
  { type: "start",     label: "Start",      icon: "▶",  desc: "Einstiegspunkt" },
  { type: "slot",      label: "Slot",       icon: "✏️",  desc: "Nutzereingabe sammeln" },
  { type: "dialog",    label: "Dialog",     icon: "💬", desc: "LLM-Antwort" },
  { type: "condition", label: "Bedingung",  icon: "◆",  desc: "Verzweigung" },
  { type: "webhook",   label: "Webhook",    icon: "🔗", desc: "API-Aufruf" },
  { type: "end",       label: "Ende",       icon: "⏹",  desc: "Flow beenden" },
]

// ---------------------------------------------------------------------------
// Custom Node Components
// ---------------------------------------------------------------------------

function BaseNode({ data, selected, color, icon, children }) {
  return (
    <div style={{
      minWidth: 180,
      maxWidth: 240,
      background: C.surface,
      border: `2px solid ${selected ? color : C.border}`,
      borderRadius: 10,
      boxShadow: selected
        ? `0 0 0 3px ${color}30, 0 4px 16px rgba(0,0,0,0.12)`
        : "0 2px 8px rgba(0,0,0,0.08)",
      overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: color,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>
          {data.label || NODE_META[data.nodeType]?.label || "Node"}
        </span>
      </div>
      {/* Body */}
      {children && (
        <div style={{ padding: "8px 12px", fontSize: 12, color: C.muted }}>
          {children}
        </div>
      )}
    </div>
  )
}

function StartNode({ data, selected }) {
  return (
    <>
      <BaseNode data={data} selected={selected} color={NODE_META.start.color} icon={NODE_META.start.icon}>
        <span style={{ color: C.text, fontSize: 11 }}>Eingang des Flows</span>
      </BaseNode>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_META.start.color, width: 10, height: 10 }} />
    </>
  )
}

function SlotNode({ data, selected }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: NODE_META.slot.color, width: 10, height: 10 }} />
      <BaseNode data={data} selected={selected} color={NODE_META.slot.color} icon={NODE_META.slot.icon}>
        {data.slot_name && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: C.text }}>{data.slot_name}</span>
            {data.slot_type && <span style={{ marginLeft: 6, color: C.muted }}>({data.slot_type})</span>}
          </div>
        )}
        {data.question && (
          <div style={{ color: C.muted, fontStyle: "italic", fontSize: 11 }}
            title={data.question}>
            {data.question.length > 50 ? data.question.slice(0, 50) + "…" : data.question}
          </div>
        )}
      </BaseNode>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_META.slot.color, width: 10, height: 10 }} />
    </>
  )
}

function DialogNode({ data, selected }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: NODE_META.dialog.color, width: 10, height: 10 }} />
      <BaseNode data={data} selected={selected} color={NODE_META.dialog.color} icon={NODE_META.dialog.icon}>
        {data.prompt
          ? <div style={{ fontStyle: "italic", fontSize: 11 }} title={data.prompt}>
              {data.prompt.length > 60 ? data.prompt.slice(0, 60) + "…" : data.prompt}
            </div>
          : <span style={{ color: C.muted }}>LLM-generierte Antwort</span>
        }
      </BaseNode>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_META.dialog.color, width: 10, height: 10 }} />
    </>
  )
}

function ConditionNode({ data, selected }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: NODE_META.condition.color, width: 10, height: 10 }} />
      <BaseNode data={data} selected={selected} color={NODE_META.condition.color} icon={NODE_META.condition.icon}>
        {data.description
          ? <span style={{ fontSize: 11 }}>{data.description}</span>
          : <span style={{ color: C.muted }}>Verzweigung</span>
        }
      </BaseNode>
      <Handle type="source" position={Position.Bottom} id="a" style={{ left: "30%", background: NODE_META.condition.color, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ left: "70%", background: NODE_META.condition.color, width: 10, height: 10 }} />
    </>
  )
}

function WebhookNode({ data, selected }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: NODE_META.webhook.color, width: 10, height: 10 }} />
      <BaseNode data={data} selected={selected} color={NODE_META.webhook.color} icon={NODE_META.webhook.icon}>
        {data.webhook_name
          ? <span style={{ fontWeight: 600, color: C.text }}>{data.webhook_name}</span>
          : <span style={{ color: C.muted }}>Kein Webhook gewählt</span>
        }
      </BaseNode>
      <Handle type="source" position={Position.Bottom} style={{ background: NODE_META.webhook.color, width: 10, height: 10 }} />
    </>
  )
}

function EndNode({ data, selected }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: NODE_META.end.color, width: 10, height: 10 }} />
      <BaseNode data={data} selected={selected} color={NODE_META.end.color} icon={NODE_META.end.icon}>
        {data.message
          ? <div style={{ fontStyle: "italic", fontSize: 11 }} title={data.message}>
              {data.message.length > 60 ? data.message.slice(0, 60) + "…" : data.message}
            </div>
          : <span style={{ color: C.muted }}>Abschlussnachricht</span>
        }
      </BaseNode>
    </>
  )
}

const nodeTypes = {
  start:     StartNode,
  slot:      SlotNode,
  dialog:    DialogNode,
  condition: ConditionNode,
  webhook:   WebhookNode,
  end:       EndNode,
}

// ---------------------------------------------------------------------------
// Default edge style
// ---------------------------------------------------------------------------

const defaultEdgeOptions = {
  type: "smoothstep",
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, color: C.muted },
  style: { stroke: C.muted, strokeWidth: 2 },
  labelStyle: { fontSize: 11, fill: C.text, fontFamily: "sans-serif" },
  labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
  labelBgPadding: [6, 3],
  labelBgBorderRadius: 4,
}

// ---------------------------------------------------------------------------
// Node Palette
// ---------------------------------------------------------------------------

let nodeIdCounter = 100

function NodePalette({ onAddNode }) {
  return (
    <div style={{
      position: "absolute", top: 52, left: 0, bottom: 0, width: 180,
      background: C.surface, borderRight: `1px solid ${C.border}`,
      overflowY: "auto", zIndex: 10, padding: "12px 8px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase",
        letterSpacing: 0.8, marginBottom: 10, paddingLeft: 8 }}>
        Nodes
      </div>
      {PALETTE_NODES.map(item => (
        <button
          key={item.type}
          onClick={() => onAddNode(item.type)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            width: "100%", padding: "9px 10px", marginBottom: 4,
            background: "transparent", border: `1px solid ${C.border}`,
            borderRadius: 8, cursor: "pointer", textAlign: "left",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = NODE_META[item.type].color + "12"
            e.currentTarget.style.borderColor = NODE_META[item.type].color
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.borderColor = C.border
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: NODE_META[item.type].color + "20",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}>
            {item.icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{item.desc}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Properties Panel
// ---------------------------------------------------------------------------

function PropertiesPanel({ node, webhooks, onChange, onDelete, onLabelChange }) {
  const data = node.data || {}
  const ntype = node.type
  const meta = NODE_META[ntype] || {}

  function field(label, key, type = "text", placeholder = "") {
    return (
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          {label}
        </label>
        {type === "textarea" ? (
          <textarea
            value={data[key] || ""}
            onChange={e => onChange(node.id, { [key]: e.target.value })}
            placeholder={placeholder}
            rows={3}
            style={{ width: "100%", padding: "6px 10px", border: `1px solid ${C.border}`,
              borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box",
              fontFamily: "inherit" }}
          />
        ) : type === "select-webhook" ? (
          <select
            value={data.webhook_id || ""}
            onChange={e => {
              const wh = webhooks.find(w => w.id === e.target.value)
              onChange(node.id, { webhook_id: e.target.value, webhook_name: wh?.name || "" })
            }}
            style={{ width: "100%", padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}
          >
            <option value="">— Webhook wählen —</option>
            {(webhooks || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        ) : type === "select-slottype" ? (
          <select
            value={data.slot_type || "string"}
            onChange={e => onChange(node.id, { slot_type: e.target.value })}
            style={{ width: "100%", padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}
          >
            {["string", "email", "boolean", "enum"].map(t => <option key={t}>{t}</option>)}
          </select>
        ) : (
          <input
            type="text"
            value={data[key] || ""}
            onChange={e => onChange(node.id, { [key]: e.target.value })}
            placeholder={placeholder}
            style={{ width: "100%", padding: "6px 10px", border: `1px solid ${C.border}`,
              borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{
      position: "absolute", top: 52, right: 0, bottom: 0, width: 260,
      background: C.surface, borderLeft: `1px solid ${C.border}`,
      overflowY: "auto", zIndex: 10, padding: 16,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        paddingBottom: 12, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: meta.color + "20",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
        }}>
          {meta.icon}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Node bearbeiten</div>
        </div>
      </div>

      {/* Label (all types) */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          Bezeichnung
        </label>
        <input
          type="text"
          value={data.label || ""}
          onChange={e => onChange(node.id, { label: e.target.value })}
          placeholder={meta.label}
          style={{ width: "100%", padding: "6px 10px", border: `1px solid ${C.border}`,
            borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
        />
      </div>

      <div style={{ height: 1, background: C.border, margin: "12px 0" }} />

      {/* Type-specific fields */}
      {ntype === "slot" && (
        <>
          {field("Slot-Name", "slot_name", "text", "z.B. benutzername")}
          {field("Slot-Typ", "slot_type", "select-slottype")}
          {data.slot_type === "enum" && field("Erlaubte Werte (Komma)", "enum_values", "text", "Ja, Nein, Vielleicht")}
          {field("Frage an den Nutzer", "question", "textarea", "Wie lautet Ihr Benutzername?")}
        </>
      )}

      {ntype === "dialog" && (
        field("Kontext-Hinweis (optional)", "prompt", "textarea",
          "z.B. 'Du hilfst bei allgemeinen Fragen rund um das Produkt'")
      )}

      {ntype === "condition" && (
        field("Beschreibung", "description", "text", "z.B. Hat Account")
      )}

      {ntype === "webhook" && (
        <>
          {field("Webhook", "webhook_id", "select-webhook")}
          {field("Payload-Template (JSON, optional)", "payload_template", "textarea",
            '{"user": "{{benutzername}}"}')}
        </>
      )}

      {ntype === "end" && (
        field("Abschlussnachricht", "message", "textarea",
          "Vielen Dank! Ihre Anfrage wurde bearbeitet.")
      )}

      {/* Delete */}
      <div style={{ marginTop: 24 }}>
        <button
          onClick={() => onDelete(node.id)}
          style={{
            width: "100%", padding: "8px", borderRadius: 6, border: "none",
            background: "#fee2e2", color: C.error, cursor: "pointer",
            fontSize: 13, fontWeight: 500,
          }}
        >
          Node löschen
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main FlowEditor
// ---------------------------------------------------------------------------

function flowDefToReactFlow(definition) {
  if (definition?.nodes?.length) {
    return {
      nodes: definition.nodes,
      edges: definition.edges || [],
    }
  }
  // Legacy flat format or empty → default template
  return {
    nodes: [
      { id: "start-1", type: "start", position: { x: 300, y: 50 },
        data: { label: "Start", nodeType: "start" } },
      { id: "end-1", type: "end", position: { x: 300, y: 220 },
        data: { label: "Ende", message: "Vielen Dank! Ihre Anfrage wurde bearbeitet.", nodeType: "end" } },
    ],
    edges: [
      { id: "e-start-end", source: "start-1", target: "end-1",
        ...defaultEdgeOptions },
    ],
  }
}

export default function FlowEditor({ flow, webhooks, onSave, onClose }) {
  const initial = flowDefToReactFlow(flow?.definition)
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedNode, setSelectedNode] = useState(null)
  const [saving, setSaving] = useState(false)
  const [edgeLabel, setEdgeLabel] = useState("")
  const reactFlowWrapper = useRef(null)

  // Sync selectedNode with nodes state
  useEffect(() => {
    if (selectedNode) {
      const updated = nodes.find(n => n.id === selectedNode.id)
      if (updated) setSelectedNode(updated)
    }
  }, [nodes]) // eslint-disable-line

  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      ...defaultEdgeOptions,
      id: `e-${params.source}-${params.target}-${Date.now()}`,
      label: edgeLabel || "",
    }
    setEdges(eds => addEdge(newEdge, eds))
  }, [edgeLabel, setEdges])

  function addNode(type) {
    const id = `${type}-${++nodeIdCounter}`
    const newNode = {
      id,
      type,
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 150 },
      data: { label: NODE_META[type]?.label || type, nodeType: type },
    }
    setNodes(nds => [...nds, newNode])
  }

  function updateNodeData(nodeId, updates) {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ))
  }

  function deleteNode(nodeId) {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }

  function onNodeClick(_, node) {
    setSelectedNode(node)
  }

  function onPaneClick() {
    setSelectedNode(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const definition = {
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map(e => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
          label: e.label || "",
        })),
      }
      await onSave(flow?.id || null, {
        name: flow?.name || "Neuer Flow",
        intent_name: flow?.intent_name || "neuer_flow",
        description: flow?.description || "",
        priority: flow?.priority || 0,
        is_active: flow?.is_active !== false,
        definition,
      })
      onClose()
    } catch (err) {
      alert("Fehler beim Speichern: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const mainLeft = 180
  const mainRight = selectedNode ? 260 : 0

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: C.bg, display: "flex", flexDirection: "column",
    }}>
      {/* Toolbar */}
      <div style={{
        height: 52, background: C.sidebar, display: "flex",
        alignItems: "center", padding: "0 16px", gap: 12,
        flexShrink: 0, borderBottom: `1px solid rgba(255,255,255,0.1)`,
      }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginRight: 8 }}>
          ⚡ {flow?.name || "Flow Editor"}
        </div>
        <div style={{ flex: 1 }} />

        {/* Edge label input */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Verbindungs-Label:</span>
          <input
            value={edgeLabel}
            onChange={e => setEdgeLabel(e.target.value)}
            placeholder="z.B. Slot gefüllt"
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, width: 160,
            }}
          />
        </div>

        <button
          onClick={onClose}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)",
            background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13,
          }}
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "6px 18px", borderRadius: 6, border: "none",
            background: C.primary, color: "#fff", cursor: saving ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Speichern..." : "💾 Speichern"}
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ position: "relative", flex: 1 }}>
        <NodePalette onAddNode={addNode} />

        <div
          ref={reactFlowWrapper}
          style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: mainLeft,
            right: mainRight,
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode="Delete"
          >
            <Background color="#d1d5db" gap={20} size={1} />
            <Controls style={{ bottom: 16, left: 16 }} />
            <MiniMap
              style={{ bottom: 16, right: 16 }}
              nodeColor={n => NODE_META[n.type]?.color || C.muted}
              maskColor="rgba(0,0,0,0.04)"
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            webhooks={webhooks}
            onChange={updateNodeData}
            onDelete={deleteNode}
          />
        )}
      </div>
    </div>
  )
}
