const criticalityWeight = { low: 1, medium: 2, high: 3, critical: 5 };

function toNode(row) {
  return { id: Number(row.id), name: row.name, type: row.node_type, criticality: row.criticality };
}

export class SqliteLineageRepository {
  constructor(database) {
    this.database = database;
    this.findNode = database.prepare("SELECT * FROM lineage_nodes WHERE id = ?");
    this.listNodes = database.prepare("SELECT * FROM lineage_nodes ORDER BY id");
    this.listEdges = database.prepare(`
      SELECT id, from_node_id AS fromNodeId, to_node_id AS toNodeId, relation
      FROM lineage_edges ORDER BY id
    `);
    this.childrenFor = database.prepare(`
      SELECT child.*, edge.relation
      FROM lineage_edges edge JOIN lineage_nodes child ON child.id = edge.to_node_id
      WHERE edge.from_node_id = ? ORDER BY child.id
    `);
  }

  graph() {
    return {
      nodes: this.listNodes.all().map(toNode),
      edges: this.listEdges.all().map((edge) => ({
        id: Number(edge.id), fromNodeId: Number(edge.fromNodeId), toNodeId: Number(edge.toNodeId), relation: edge.relation,
      })),
    };
  }

  impact(nodeId) {
    const rootRow = this.findNode.get(nodeId);
    if (!rootRow) return null;
    const root = toNode(rootRow);
    const affected = [];
    const visited = new Set([root.id]);

    const walk = (currentId, path) => {
      for (const child of this.childrenFor.all(currentId)) {
        if (visited.has(Number(child.id))) continue;
        visited.add(Number(child.id));
        const node = toNode(child);
        const nextPath = [...path, node.id];
        affected.push({ ...node, relation: child.relation, depth: nextPath.length - 1, path: nextPath });
        walk(node.id, nextPath);
      }
    };
    walk(root.id, [root.id]);

    const weightedImpact = affected.reduce((total, node) => total + criticalityWeight[node.criticality], 0);
    return {
      root,
      affected,
      blastRadius: affected.length,
      riskScore: Math.min(100, weightedImpact * 10),
      riskLevel: weightedImpact >= 8 ? "critical" : weightedImpact >= 4 ? "high" : weightedImpact > 0 ? "medium" : "low",
    };
  }
}
