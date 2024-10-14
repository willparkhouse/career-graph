import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import { EdgeDisplayData, NodeDisplayData } from "sigma/types";
import './styles.css';

const graph = new Graph();

interface State {
  hoveredNode?: string;
  hoveredNeighbors?: Set<string>;
  showLabels: boolean;
  selectedNode?: string;
}

Promise.all([
  fetch('nodes.json').then(response => response.json()),
  fetch('edges.json').then(response => response.json()) 
]).then(([nodes, edges]: [string[], [string, string][]]) => {

  const gridWidth = Math.ceil(Math.sqrt(nodes.length));
  const spacing = 0.001;
  nodes.forEach((nodeLabel, index) => {
    const row = Math.floor(index / gridWidth);
    const col = index % gridWidth;
    const x = col * spacing;
    const y = row * spacing;

    graph.addNode(nodeLabel, {
      label: nodeLabel,
      x: x,
      y: y,
      size: 4,
      color: "#6699CC",
    });
  });

  edges.forEach(([source, target]) => {
    graph.addEdge(source, target, {
      size: 0.2,
      color: "#CCCCCC",
    });
  });

  applyForceAtlas2AndNoOverlap();
  graph.export();
}).catch(error => console.error('Error loading nodes or edges:', error));

const updateNodeAttributes = () => {
  let maxDegree = -Infinity;
  let minDegree = Infinity;
  const degreeCache: Record<string, number> = {};

  // calculate degrees and determine min/max degree
  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    degreeCache[node] = degree; // cache degree
    if (degree > maxDegree) maxDegree = degree;
    if (degree < minDegree) minDegree = degree;
  });

  // update node attributes based on cached degree
  graph.forEachNode((node) => {
    const degree = degreeCache[node]; // retrieve cached degree
    const color = interpolateColor(degree, minDegree, maxDegree);
    const size = 1 + degree * 0.04;
    graph.setNodeAttribute(node, 'color', color);
    graph.setNodeAttribute(node, 'size', size);
  });
  createDynamicColorScale(minDegree, maxDegree);
};



const applyForceAtlas2AndNoOverlap = () => {
  const forceSettings = {
    iterations: 100,
    settings: {
      barnesHutOptimize: true,
      barnesHutTheta: 0.5,
      gravity: 0.1,
      scalingRatio: 5,
      slowDown: 10,
    },
  };
  forceAtlas2.assign(graph, forceSettings);
  const noverlapSettings = {
    margin: 120,
    ratio: 1.5,
    maxIterations: 100,
    speed: 3,
  };
  noverlap.assign(graph, noverlapSettings);
  updateNodeAttributes();
  const container = document.getElementById("container") as HTMLDivElement;
  const renderer = new Sigma(graph, container);
  const state: State = { showLabels: true };
  let isBatching = false;
  let refreshTimeout: number | null = null;
  
  const debouncedAndBatchedRefresh = (refreshMs: number) => {
    if (refreshTimeout !== null) {
      clearTimeout(refreshTimeout);
    }
    refreshTimeout = window.setTimeout(() => {
      if (!isBatching) {
        isBatching = true;
        requestAnimationFrame(() => {
          renderer.refresh();
          isBatching = false;
          refreshTimeout = null;
        });
      }
    }, refreshMs);
  };
  function setHoveredNode(node?: string) {
    if (node) {
      state.hoveredNode = node;
      state.hoveredNeighbors = new Set(graph.neighbors(node));
    } else {
      state.hoveredNode = undefined;
      state.hoveredNeighbors = undefined;
    }
    debouncedAndBatchedRefresh(30); 
  }
  
  function applyLabelVisibility() {
    const zoomRatio = renderer.getCamera().getState().ratio;
    state.showLabels = zoomRatio < 0.1;
    debouncedAndBatchedRefresh(150);
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




// Func to interpolate color based on the number of connections
const interpolateColor = (value: number, min: number, max: number) => {
  const ratio = (value - min) / (max - min);

  // Starting color: rgb(102, 153, 255)
  const startR = 102;
  const startG = 153;
  const startB = 255;

  // Ending color: rgb(255, 102, 102)
  const endR = 255;
  const endG = 102;
  const endB = 102;

  const r = Math.floor(startR + ratio * (endR - startR));
  const g = Math.floor(startG + ratio * (endG - startG));
  const b = Math.floor(startB + ratio * (endB - startB));
  return `rgb(${r}, ${g}, ${b})`;
};

// Func for the 'number of connections' legend
const createDynamicColorScale = (minDegree: number, maxDegree: number) => {
  const ticksContainer = document.getElementById("ticks");
  if (ticksContainer) {
    ticksContainer.innerHTML = ""; 
  }
  const numberOfTicks = 5;
  for (let i = 0; i < numberOfTicks; i++) {
    const tickValue = Math.round(minDegree + (i / (numberOfTicks - 1)) * (maxDegree - minDegree));

    const tick = document.createElement("div");
    tick.classList.add("tick");

    const tickLabel = document.createElement("span");
    tickLabel.textContent = tickValue.toString();
    tick.appendChild(tickLabel);

    if (ticksContainer) {
      ticksContainer.appendChild(tick);
    }
  }
};