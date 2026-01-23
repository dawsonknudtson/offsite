const openTabButton = document.querySelector(".open-tab");
const disableButton = document.querySelector(".disable-blocking");

openTabButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://newtab" });
});

disableButton.addEventListener("click", async () => {
  await chrome.storage.local.set({ enabled: false });
});
