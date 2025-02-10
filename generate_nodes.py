import random
from dataclasses import dataclass


class NodeObject:
    def __init__(
        self,
        id: str,
        x: float,
        y: float,
        width: float,
        height: float,
        color: str,
        weight: float,
    ):
        self.id = id
        self.x = x
        self.y = y
        self.weight = weight
        self.width = width
        self.height = height
        self.color = color
        self.vx = 0.01
        self.vy = 0.01

    def to_dict(self):
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "color": self.color,
            "weight": self.weight,
            "vx": self.vx,
            "vy": self.vy,
        }


@dataclass
class NodeGenerationConfig:
    total_nodes: int
    isolated_percentage: float
    max_group_size: int = 6
    min_group_size: int = 3


@dataclass
class GeneratedData:
    nodes: list[NodeObject]
    edges: list[tuple[str, str]]
    groups: dict[int, list[str]]


class GroupBasedGenerator:
    def __init__(self, config: NodeGenerationConfig):
        self.config = config
        self.nodes: list[NodeObject] = []
        self.available_nodes: set[str] = set()
        self.isolated_nodes: set[str] = set()
        self.node_relationships: dict[str, set[str]] = {}
        self.groups: dict[int, list[str]] = {}
        self.node_to_group: dict[str, int] = {}

    def initialize_nodes(self) -> None:
        """Initialize nodes and determine isolated ones."""
        # Create all nodes
        self.nodes = []
        for i in range(self.config.total_nodes):
            node = NodeObject(
                id=f"node{i}",
                x=1,
                y=1,
                width=50,
                height=50,
                weight=50,
                color="hsl(0, 0%, 0%)",
            )
            self.nodes.append(node)
        all_node_ids = {node.id for node in self.nodes}

        # Calculate and select isolated nodes
        isolated_count = int(
            self.config.total_nodes * (self.config.isolated_percentage / 100)
        )
        node_ids = list(all_node_ids)
        self.isolated_nodes = set(random.sample(node_ids, isolated_count))

        # Set available nodes (non-isolated)
        self.available_nodes = all_node_ids - self.isolated_nodes

        # Initialize relationship tracking
        self.node_relationships = {node_id: set() for node_id in self.available_nodes}

    def create_groups(self):
        remaining_nodes = list(self.available_nodes)
        random.shuffle(remaining_nodes)
        group_id = 0

        while remaining_nodes:
            max_possible_size = min(self.config.max_group_size, len(remaining_nodes))
            if max_possible_size < self.config.min_group_size:
                self.isolated_nodes.update(remaining_nodes)
                break

            group_size = random.randint(self.config.min_group_size, max_possible_size)
            group_nodes = remaining_nodes[:group_size]
            remaining_nodes = remaining_nodes[group_size:]

            self.groups[group_id] = group_nodes
            for node_id in group_nodes:
                self.node_to_group[node_id] = group_id
            group_id += 1

    def generate_intra_group_relationships(self) -> list[tuple[str, str]]:
        edges = []
        for group_nodes in self.groups.values():
            group_relationships = {node: set() for node in group_nodes}

            for i in range(len(group_nodes) - 1):
                node1, node2 = group_nodes[i], group_nodes[i + 1]
                group_relationships[node1].add(node2)
                group_relationships[node2].add(node1)
                edges.append((node1, node2))

            for node in group_nodes:
                possible_connections = [
                    n
                    for n in group_nodes
                    if n != node and n not in group_relationships[node]
                ]

                additional_connections = random.randint(
                    0, min(1, len(possible_connections))
                )
                if additional_connections > 0 and possible_connections:
                    selected_connections = random.sample(
                        possible_connections,
                        min(additional_connections, len(possible_connections)),
                    )
                    for target in selected_connections:
                        group_relationships[node].add(target)
                        group_relationships[target].add(node)
                        edges.append((node, target))
        return edges

    def generate(self) -> GeneratedData:
        self.initialize_nodes()
        self.create_groups()

        edges = self.generate_intra_group_relationships()
        return GeneratedData(
            nodes=self.nodes,
            edges=edges,
            groups=self.groups,
        )


def generate_node_relationships(config: NodeGenerationConfig):
    generator = GroupBasedGenerator(config)
    return generator.generate()
