import json
from collections import defaultdict as dfd
import sys, os
import parsers.parsers as P


nodes_ids = dfd(int)
nodes = []
edges = []
edge_ids = dfd(int)

black_list = {
  "ip": ["127.0.0.1", "localhost", "-", "::1"],
  "machine_name": ["127.0.0.1", "localhost", "-"],
  "user_name": ["N/A", "-"],

}

def get_add_node(node_type, node_value):
  node = (node_type, node_value)
  if node in nodes_ids:
    return nodes_ids[node]
  else:
    nodes_ids[node] = len(nodes_ids)
    nodes.append({
      "id":nodes_ids[node],
      "value":node_value,
      "type":node_type
      })
    return nodes_ids[node]

def add_edge(source_id, target_id, edge_type, time=None, event_id=None):
  edge = (source_id, target_id, edge_type)
  if edge in edge_ids:
    edges[edge_ids[edge]]["count"] += 1

  else:
    edge_ids[edge] = len(edges)
    edges.append({
        "source":source_id,
        "target":target_id,
        "type": edge_type,
        "count": 1
        })

if __name__ == "__main__":
  if len(sys.argv)<=2:
    print("input, output")
    sys.exit(1)

  data_file = sys.argv[1]
  data = json.load(open(data_file))

  groups = dfd(int)

  HAS = "has"
  IS = "is"
  ACCEESS = "access"


  rules = [
  (P.SOURCE_MACHINE_IP, P.SOURCE_MACHINE_NAME, IS),

  (P.TARGET_MACHINE_NAME, P.TARGET_MACHINE_IP, IS),

  (P.TARGET_USER_ID, P.TARGET_USER_NAME, IS),

  (P.TARGET_USER_NAME, P.TARGET_PID, HAS),
  (P.TARGET_USER_ID, P.TARGET_PID, HAS),
  (P.TARGET_MACHINE_IP, P.TARGET_USER_NAME, HAS),
  (P.TARGET_MACHINE_IP, P.TARGET_USER_ID, HAS),
  (P.TARGET_MACHINE_NAME, P.TARGET_USER_NAME, HAS),
  (P.TARGET_MACHINE_NAME, P.TARGET_USER_ID, HAS),


  (P.TARGET_USER_NAME, P.TARGET_USER_ID, IS),


  (P.SOURCE_MACHINE_IP, P.TARGET_MACHINE_IP, ACCEESS),
  (P.SOURCE_MACHINE_IP, P.TARGET_MACHINE_NAME, ACCEESS),
  (P.SOURCE_MACHINE_IP, P.TARGET_USER_NAME, ACCEESS),
  (P.SOURCE_MACHINE_IP, P.TARGET_USER_ID, ACCEESS),

  (P.SOURCE_MACHINE_NAME, P.TARGET_MACHINE_IP, ACCEESS),
  (P.SOURCE_MACHINE_NAME, P.TARGET_MACHINE_NAME, ACCEESS),
  (P.SOURCE_MACHINE_NAME, P.TARGET_USER_NAME, ACCEESS),
  (P.SOURCE_MACHINE_NAME, P.TARGET_USER_ID, ACCEESS)
  ]

  for event in data:
    for rule in rules:
      source_type = rule[0].split(":")[1]
      source = event.get(rule[0])

      target_type = rule[1].split(":")[1]
      target = event.get(rule[1])
      if not(source and target):
        continue

      if source in black_list.get(source_type, []):
        continue

      if target in black_list.get(target_type, []):
        continue

      source_id = get_add_node(source_type, source)
      target_id = get_add_node(target_type,target)
      add_edge(source_id, target_id, rule[2])


  graph_file = open(sys.argv[2],"w")
  graph_file.write("var graph =")
  graph_file.write(json.dumps({"nodes":nodes,"links":edges}))
