module.exports = {
  baseUrl: process.env.PKULAW_MCP_URL || 'https://apim-gateway.pkulaw.com/mcp-law-search-service',
  token: process.env.PKULAW_MCP_TOKEN || '',
  timeout: Number(process.env.PKULAW_MCP_TIMEOUT) || 15000,
  searchTool: process.env.PKULAW_TOOL_SEARCH || 'search_article',
  getTool: process.env.PKULAW_TOOL_GET || 'get_article',
};
