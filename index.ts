import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import { EdgeDisplayData, NodeDisplayData } from "sigma/types";  // Add this line to import the types

const graph = new Graph();
const addedNodes = new Set<string>();

// Function to add a node if it doesn't already exist
const addNodeIfNotExist = (nodeLabel: string) => {
  if (!addedNodes.has(nodeLabel)) {
    graph.addNode(nodeLabel, {
      label: nodeLabel,
      x: Math.random(),
      y: Math.random(),
      size: 4,
      color: "#6699CC",
    });
    addedNodes.add(nodeLabel);
  }
};

const interpolateColor = (value: number, min: number, max: number) => {
  const ratio = (value - min) / (max - min);
  const r = Math.floor(255 * ratio); // Red increases with the ratio
  const b = Math.floor(255 * (1 - ratio)); // Blue decreases with the ratio
  return `rgb(${r}, 0, ${b})`; // Blue to Red transition
};

// Function to update node size and color based on degree (number of connections)
const updateNodeAttributes = () => {
  const degrees = graph.nodes().map(node => graph.degree(node));
  const maxDegree = Math.max(...degrees);
  const minDegree = Math.min(...degrees);

  graph.forEachNode((node, attributes) => {
    const degree = graph.degree(node);
    const color = interpolateColor(degree, minDegree, maxDegree);
    const size = 1 + degree * 0.04; // Adjust size based on degree
    graph.setNodeAttribute(node, 'color', color);
    graph.setNodeAttribute(node, 'size', size);
  });
};

// Function to apply ForceAtlas2 and NoOverlap algorithms
const applyForceAtlas2AndNoOverlap = () => {
  const forceSettings = {
    iterations: 100,
    settings: {
      barnesHutOptimize: true,
      barnesHutTheta: 0.5,
      gravity: 1,
      scalingRatio: 2,
      slowDown: 1,
    },
  };

  // Apply the ForceAtlas2 layout
  forceAtlas2.assign(graph, forceSettings);

  const noverlapSettings = {
    margin: 120,
    ratio: 1.5,
    maxIterations: 100,
    speed: 3,
  };

  // Apply the NoOverlap layout
  noverlap.assign(graph, noverlapSettings);

  updateNodeAttributes();

  const container = document.getElementById("container") as HTMLDivElement;
  const renderer = new Sigma(graph, container);

  const state: State = { showLabels: true };

  function setHoveredNode(node?: string) {
    if (node) {
      state.hoveredNode = node;
      state.hoveredNeighbors = new Set(graph.neighbors(node));
    } else {
      state.hoveredNode = undefined;
      state.hoveredNeighbors = undefined;
    }
    renderer.refresh();
  }

  function applyLabelVisibility() {
    const zoomRatio = renderer.getCamera().getState().ratio;
    state.showLabels = zoomRatio < 0.1;
    renderer.refresh();
  }

  function updateSuggestions(query: string) {
    const suggestions = document.getElementById("suggestions") as HTMLUListElement;
    suggestions.innerHTML = "";

    const matchingNodes = graph
      .nodes()
      .filter((id) => {
        const label = graph.getNodeAttribute(id, "label");
        return label && label.toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, 20)
      .map((id) => graph.getNodeAttribute(id, "label"));

    matchingNodes.forEach((label) => {
      const li = document.createElement("li");
      li.textContent = label as string;
      li.addEventListener("click", () => {
        focusOnNode(label as string);
        suggestions.innerHTML = "";
      });
      suggestions.appendChild(li);
    });
  }

  function focusOnNode(label: string) {
    const nodeId = graph.nodes().find((id) => graph.getNodeAttribute(id, "label") === label);

    if (nodeId) {
      state.selectedNode = nodeId;

      const nodePosition = renderer.getNodeDisplayData(nodeId);
      if (nodePosition) {
        renderer.getCamera().animate(nodePosition, { duration: 500 });
      }

      setHoveredNode(nodeId);
    }
  }

  function resetGraphView() {
    state.selectedNode = undefined;
    setHoveredNode(undefined);
    renderer.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1.2 }, { duration: 500 });
  }

  const searchBox = document.getElementById("search-box") as HTMLInputElement;
  searchBox.addEventListener("input", () => {
    updateSuggestions(searchBox.value);
  });

  renderer.on("clickStage", () => {
    resetGraphView();
  });

  applyLabelVisibility();

  renderer.on("enterNode", ({ node }) => {
    setHoveredNode(node);
  });

  renderer.on("leaveNode", () => {
    setHoveredNode(undefined);
  });

  const camera = renderer.getCamera();
  camera.on("updated", applyLabelVisibility);

  renderer.setSetting("nodeReducer", (node, data) => {
    const res: Partial<NodeDisplayData> = { ...data };

    if (state.hoveredNode || state.selectedNode) {
      if (state.hoveredNode === node || state.hoveredNeighbors?.has(node) || state.selectedNode === node) {
        res.forceLabel = true;
        res.color = data.color;
      } else {
        res.label = "";
        res.color = "#f6f6f6";
      }
    } else {
      if (!state.showLabels) res.label = "";
      res.color = data.color;
    }

    return res;
  });

  renderer.setSetting("edgeReducer", (edge, data) => {
    const res: Partial<EdgeDisplayData> = { ...data };

    if (state.hoveredNode && !graph.hasExtremity(edge, state.hoveredNode)) {
      res.hidden = true;
    }

    return res;
  });
};

// Fetch JSON data dynamically at runtime
fetch('data.json')
  .then(response => response.json())
  .then((data: { profession: string; related_professions: string[] }[]) => {
    data.forEach((professionData) => {
      const profession = professionData.profession;

      addNodeIfNotExist(profession);

      professionData.related_professions.forEach((relatedProfession) => {
        addNodeIfNotExist(relatedProfession);

        if (!graph.hasEdge(profession, relatedProfession) && !graph.hasEdge(relatedProfession, profession)) {
          graph.addEdge(profession, relatedProfession, {
            size: 0.2,
            color: "#CCCCCC",
          });
        }
      });
    });

    applyForceAtlas2AndNoOverlap();
  })
  .catch(error => console.error('Error loading JSON:', error));

// State interface
interface State {
  hoveredNode?: string;
  hoveredNeighbors?: Set<string>;
  showLabels: boolean;
  selectedNode?: string;
}
