// Local cookie sessions expire or are revoked at logout/server restart.
window.BolPrepFetch = async (resource, options) => {
  const response = await fetch(resource, options);
  const url = new URL(typeof resource === "string" ? resource : resource.url, window.location.href);
  if (response.status === 401 && url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
    window.dispatchEvent(new Event("bolprep-access-expired"));
    window.location.replace("/login");
    throw new Error("Sign in to continue.");
  }
  return response;
};
