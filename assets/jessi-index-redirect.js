(function jessiIndexRedirect() {
  function go() {
    location.replace("jessi-beauty-marketing-workflow.html");
  }
  if (document.documentElement.classList.contains("auth-pending")) {
    const obs = new MutationObserver(() => {
      if (!document.documentElement.classList.contains("auth-pending")) {
        obs.disconnect();
        go();
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return;
  }
  go();
})();
