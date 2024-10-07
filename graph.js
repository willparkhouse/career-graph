// Load the data
fetch('data.json')
  .then(response => response.json())
  .then(data => {
    const graph = {
      nodes: [],
      edges: []
    };
    
    const nodesSet = new Set();

    // Create nodes and edges
    data.forEach((item, index) => {
      const profession = item.profession;

      // Add profession as a node if not already in the set
      if (!nodesSet.has(profession)) {
        graph.nodes.push({
          id: profession,
          label: profession,
          x: Math.random(),
          y: Math.random(),
          size: 1,
          color: '#6699CC'
        });
        nodesSet.add(profession);
      }

      // Add related professions as nodes and edges
      item.related_professions.forEach((related, relatedIndex) => {
        if (!nodesSet.has(related)) {
          graph.nodes.push({
            id: related,
            label: related,
            x: Math.random(),
            y: Math.random(),
            size: 1,
            color: '#FFCC33'
          });
          nodesSet.add(related);
        }

        // Create an edge between profession and related profession
        graph.edges.push({
          id: `edge-${index}-${relatedIndex}`,
          source: profession,
          target: related,
          size: 1,
          color: '#CCCCCC'
        });
      });
    });

    // Render the graph using Sigma.js
    const container = document.getElementById('graph-container');
    const sigmaInstance = new sigma({ graph, container });

    // Apply initial camera settings for better view
    sigmaInstance.getCamera().goTo({ x: 0, y: 0, ratio: 1.5 });
  })
  .catch(error => console.error('Error loading graph data:', error));
