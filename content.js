// === CONFIG ===
const SERVER_URL = "http://127.0.0.1:5000/analyze";
let MY_ID = null;

// === STATE ===
let isProcessing = false;
let activeKeywords = [];
let previouslyHighlighted = [];
let riskCache = JSON.parse(localStorage.getItem("riskCache") || "{}");
let processedComments = new Set(JSON.parse(localStorage.getItem("processedComments") || "[]"));

// === ID 감지 ===
function detectMyID() {
  const allSpans = Array.from(document.querySelectorAll('article span'));
  const idCounts = {};

  for (let i = 0; i < allSpans.length - 1; i++) {
    const current = allSpans[i];
    const next = allSpans[i + 1];

    if (
      current &&
      /^[a-zA-Z0-9_.]+$/.test(current.innerText.trim()) &&
      next &&
      next.innerText
    ) {
      const id = current.innerText.trim();
      idCounts[id] = (idCounts[id] || 0) + 1;
    }
  }

  let maxId = null;
  let maxCount = 0;
  for (const id in idCounts) {
    if (idCounts[id] > maxCount) {
      maxId = id;
      maxCount = idCounts[id];
    }
  }

  return maxId;
}

// === UTIL: Cache ===
function sanitizeText(text) {
  return text.replace(/[\n🟥🟧🟨]+/g, '').trim();
}
function cacheRisk(text, score) {
  const rounded = Math.round(score * 1000) / 1000;
  riskCache[text] = rounded;
  localStorage.setItem("riskCache", JSON.stringify(riskCache));
}
function saveProcessed() {
  localStorage.setItem("processedComments", JSON.stringify([...processedComments]));
}
function isCached(text) {
  return riskCache.hasOwnProperty(text);
}
function containsKeyword(text) {
  return activeKeywords.some(k => text.includes(k));
}
// 🧠 유출 습관 분석 버튼 생성
const analyzeBtn = document.createElement('button');
analyzeBtn.textContent = "🧠 유출 습관 분석";
Object.assign(analyzeBtn.style, {
  position: 'fixed', top: '20px', right: '20px', zIndex: '9999',
  padding: '10px', fontSize: '14px', backgroundColor: '#4CAF50',
  color: '#fff', border: 'none', borderRadius: '6px',
  cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
});
document.body.appendChild(analyzeBtn);

// === UI: Keyword Input & List ===
// 🔄 분석 버튼 클릭 시 top10 위험 댓글 클립보드 복사
analyzeBtn.addEventListener('click', async () => {
  const top10 = getTop10DangerousComments();
  if (top10.length === 0) {
    alert("복사할 위험 댓글이 없습니다.");
    return;
  }

  const formatted = top10.map((item, i) =>
    `${i + 1}. ${item.text} (위험도: ${item.score})`
  ).join('\n');

  try {
    await navigator.clipboard.writeText(formatted);
    alert("✅ 위험도 높은 댓글 10개가 클립보드에 복사되었습니다.");
  } catch (err) {
    console.error("클립보드 복사 실패:", err);
    alert("❌ 복사 중 오류 발생");
  }
});


// 📋 키워드 복사 버튼 생성
const copyBtn = document.createElement('button');
copyBtn.textContent = "📋 키워드 복사";
Object.assign(copyBtn.style, {
  position: 'fixed', top: '20px', right: '150px', zIndex: '9999',
  padding: '10px', fontSize: '14px', backgroundColor: '#ff9800',
  color: '#fff', border: 'none', borderRadius: '6px',
  cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
});
document.body.appendChild(copyBtn);

// 📋 복사 기능
copyBtn.addEventListener('click', async () => {
  if (activeKeywords.length === 0) {
    alert("복사할 키워드가 없습니다.");
    return;
  }

  const textToCopy = activeKeywords.join(', ');
  try {
    await navigator.clipboard.writeText(textToCopy);
    alert("✅ 키워드가 클립보드에 복사되었습니다.");
  } catch (err) {
    console.error("클립보드 복사 실패:", err);
    alert("❌ 클립보드 복사 실패");
  }
});


const input = document.createElement('input');
input.type = 'text';
input.placeholder = 'Enter로 키워드 추가/삭제';
Object.assign(input.style, {
  position: 'fixed', top: '60px', right: '20px', zIndex: '9999',
  padding: '8px', fontSize: '16px', border: '2px solid #aaa',
  borderRadius: '6px', backgroundColor: '#fff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
});
document.body.appendChild(input);

const keywordList = document.createElement('div');
keywordList.id = "keywordList";
Object.assign(keywordList.style, {
  position: 'fixed', top: '100px', right: '20px', zIndex: '9999',
  maxWidth: '200px', padding: '10px', backgroundColor: '#f0f8ff',
  border: '2px solid #aaa', borderRadius: '6px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontSize: '14px',
  fontFamily: 'sans-serif'
});
document.body.appendChild(keywordList);


// === Keyword 관리 ===
function saveKeywords() {
  localStorage.setItem("myKeywords", JSON.stringify(activeKeywords));
}
function loadKeywords() {
  const saved = localStorage.getItem("myKeywords");
  if (saved) activeKeywords = JSON.parse(saved);
}
function renderKeywordList() {
  keywordList.innerHTML = "<b>📘 키워드 목록</b><br/>";
  if (activeKeywords.length === 0) {
    keywordList.innerHTML += "<i style='color:gray;'>없음</i>";
    return;
  }
  activeKeywords.forEach((kw, index) => {
    const item = document.createElement("div");
    item.style.marginTop = "4px";
    const span = document.createElement("span");
    span.textContent = `• ${kw}`;
    span.style.marginRight = "8px";
    const del = document.createElement("button");
    del.textContent = "❌";
    del.style.fontSize = "10px";
    del.style.cursor = "pointer";
    del.onclick = () => {
      activeKeywords.splice(index, 1);
      saveKeywords();
      applyKeywordHighlighting();
      renderKeywordList();
    };
    item.appendChild(span);
    item.appendChild(del);
    keywordList.appendChild(item);
  });
}

// === Input Handler ===
input.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const keyword = this.value.trim();
    if (keyword.length === 0) return;
    toggleKeyword(keyword);
    this.value = '';
  }
});
function toggleKeyword(keyword) {
  const index = activeKeywords.indexOf(keyword);
  if (index > -1) {
    activeKeywords.splice(index, 1);
  } else {
    activeKeywords.push(keyword);
  }
  saveKeywords();
  applyKeywordHighlighting();
  renderKeywordList();
}

// === Highlight ===
function resetHighlighting() {
  for (const el of previouslyHighlighted) {
    el.style.border = "";
    el.style.padding = "";
    el.style.backgroundColor = "";
    el.title = "";
  }
  previouslyHighlighted = [];
}
function applyKeywordHighlighting() {
  resetHighlighting();
  if (activeKeywords.length === 0) return;
  const myDivs = getMyCommentsOnly();
  for (const div of myDivs) {
    const spans = div.querySelectorAll("span");
    for (const span of spans) {
      const text = span.innerText || '';
      const matched = activeKeywords.filter(k => text.includes(k));
      if (matched.length > 0) {
        span.style.border = "2px solid blue";
        span.style.padding = "4px";
        span.style.backgroundColor = "#eaf4ff";
        span.title = `🔵 포함 키워드: ${matched.join(', ')}`;
        previouslyHighlighted.push(span);
      }
    }
  }
}

// === 내 댓글만 필터링 ===
function getMyCommentsOnly() {
  const allDivs = Array.from(document.querySelectorAll('div[dir="auto"]'));
  return allDivs.filter(div => {
    const text = div.innerText.trim();
    if (text.length < 3 || !div.offsetParent) return false;
    const parent = div.closest("div");
    const span = parent?.querySelector("span");
    return span && span.innerText.includes(MY_ID);
  });
}

// === 위험도 박스 표시 ===
function highlight(divs, risks) {
  divs.forEach((div, i) => {
    const riskData = risks[i];
    if (!riskData) return;
    

    const score = riskData.score || 0;
    const risk = Number(riskData.risk);

    let color = "", riskLevel = "", emoji = "";

    if ( score >= 60) {
      color = "#ff4444"; riskLevel = "매우 높음"; emoji = "🟥";
    } else if (score >= 40) {
      color = "#ff8800"; riskLevel = "중간 위험"; emoji = "🟧";
    } else if (score >= 30) {
      color = "#ffdd00"; riskLevel = "낮은 위험"; emoji = "🟨";
    } else {
      return; // "0" 또는 "none"인 경우 표시 안 함
    }

    div.style.border = `3px solid ${color}`;
    div.style.borderRadius = "6px";
    div.style.padding = "6px";
    div.style.backgroundColor = `${color}15`;
    div.style.position = "relative";

    const badge = document.createElement('div');
    badge.style.cssText = `position:absolute;top:-8px;right:-8px;background:${color};color:white;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold;z-index:1000;pointer-events:none;`;
    badge.textContent = emoji;
    div.appendChild(badge);

    div.title = `${emoji} 개인정보 유출 위험도: ${riskLevel} (점수: ${score})`;
  });
}

function getTop10DangerousComments() {
  return Object.entries(riskCache)
    .filter(([_, score]) => score >= 0.6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, score]) => ({ text, score }));
}

// === 댓글 분석 감시 ===
function debounce(fn, delay = 500) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
function observeMyComments() {
  const observer = new MutationObserver(debounce(async () => {
    if (isProcessing) return;
    const myDivs = getMyCommentsOnly();
    const texts = myDivs.map(div => div.innerText.trim());
    const newTexts = [], newDivs = [];

    texts.forEach(text => {
      const cleanText = sanitizeText(text);
      if (isCached(cleanText)) {
        const div = myDivs.find(d => sanitizeText(d.innerText.trim()) === cleanText);
        if (div) highlight([div], [{ score: riskCache[cleanText] }]);
        processedComments.add(cleanText);
      } else if (!processedComments.has(cleanText)) {
        newTexts.push(cleanText);
      }
    });

    newDivs.push(...myDivs.filter(div => newTexts.includes(sanitizeText(div.innerText.trim()))));

    if (newTexts.length > 0) {
      isProcessing = true;
      try {
        const res = await fetch(SERVER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: newTexts })
        });
        const result = await res.json();
        highlight(newDivs, result);
        newTexts.forEach((text, i) => {
          const score = result[i]?.score;
          if (score !== undefined) {
            const cleanText = sanitizeText(text);
            cacheRisk(cleanText, score);
            processedComments.add(cleanText);
          }
        });
        saveProcessed();
      } catch (e) {
        console.error("❌ 분석 서버 실패:", e);
      } finally {
        isProcessing = false;
      }
    }
    applyKeywordHighlighting();
  }));
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('beforeunload', () => observer.disconnect());
}

// === INIT ===
console.log("🚀 개인정보 감지 시스템 실행");
loadKeywords();
renderKeywordList();

function tryDetectIDAndStart(retryCount = 0) {
  MY_ID = detectMyID();
  if (MY_ID) {
    console.log("🧭 감지된 사용자 ID:", MY_ID);
    observeMyComments();
  } else if (retryCount < 10) {
    console.log(`🔁 사용자 ID 감지 재시도 (${retryCount + 1})`);
    setTimeout(() => tryDetectIDAndStart(retryCount + 1), 500);
  } else {
    alert("❗ 사용자 ID를 찾을 수 없습니다. 수동 설정이 필요합니다.");
  }
}

if (document.readyState !== 'complete') {
  window.addEventListener('load', () => tryDetectIDAndStart());
} else {
  tryDetectIDAndStart();
}
