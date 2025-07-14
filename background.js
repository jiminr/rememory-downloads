chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "analyze_comments") {
    fetch("http://127.0.0.1:5000/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ comments: message.comments })
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(err => sendResponse({ success: false, error: err.message }));

    return true; // 비동기 응답을 위해 true 반환
  }
});
