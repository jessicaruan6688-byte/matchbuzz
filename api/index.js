const { requestListener } = require("../server");

module.exports = async (req, res) => {
  const currentUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rewrittenPath = currentUrl.searchParams.get("__pathname");

  if (rewrittenPath) {
    currentUrl.searchParams.delete("__pathname");
    const query = currentUrl.searchParams.toString();
    req.url = query ? `${rewrittenPath}?${query}` : rewrittenPath;
  }

  return requestListener(req, res);
};
