## Profession Network Graph

A dynamic visualization of semantically similar professions in a network using graphology and Sigma.js. Nodes are color-coded based on their number of connections, with interactive search, zoom, and node focus features.

Created over a weekend after playing with the new Llama 3.2:3b LLMs locally used to generate relationships between professions, creating the core data set.

### https://willparkhouse.github.io/career-graph/


### Running locally with HMR
```
npm install --save-dev webpack webpack-cli ts-loader typescript style-loader css-loader webpack-dev-server html-webpack-plugin copy-webpack-plugin
npm start
```

### To-Do
- Improve performance on at runtime
- Improve loading time efficiency by pre-computing connections
