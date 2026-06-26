    const STORAGE = "jessi-workflow-v2";
    const SHARED_CONTEXT_KEY = "jessi-shared-context";
    const WORKFLOW_SCHEMA_VERSION = 2;
    const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

    const HK_PUBLIC_HOLIDAYS_2026 = {
      "2026-01-01": "元旦",
      "2026-02-17": "農曆年初一",
      "2026-02-18": "農曆年初二",
      "2026-02-19": "農曆年初三",
      "2026-04-03": "耶穌受難節",
      "2026-04-04": "耶穌受難節翌日",
      "2026-04-06": "清明節翌日",
      "2026-04-07": "復活節星期一翌日",
      "2026-05-01": "勞動節",
      "2026-05-25": "佛誕翌日",
      "2026-06-19": "端午節",
      "2026-07-01": "香港特區成立紀念日",
      "2026-09-26": "中秋節翌日",
      "2026-10-01": "國慶日",
      "2026-10-19": "重陽節翌日",
      "2026-12-25": "聖誕節",
      "2026-12-26": "聖誕節後第一個周日"
    };

    const PHASE1_CHECK_IDS = ["m1-1", "m1-2", "m1-3", "m1-4", "m1-5", "m1-6"];

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE) || localStorage.getItem("jessi-workflow-v1") || "{}";
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }

    function saveState(state) {
      localStorage.setItem(STORAGE, JSON.stringify(state));
    }

    let state = loadState();
    if (!state.phase) state.phase = "2";
    if (!state.shootAnchor) state.shootAnchor = new Date().toISOString().slice(0, 10);
    if (!state.contacts) state.contacts = {};
    if (!state.themeBacklog) state.themeBacklog = [];
    if (!state.weekTheme) state.weekTheme = { title: "", kw: "", why: "", weekAngles: [] };
    if (state.weekTheme.angle && (!state.weekTheme.weekAngles || !state.weekTheme.weekAngles.length)) {
      state.weekTheme.weekAngles = [state.weekTheme.angle];
    }
    if (!state.weekTheme.weekAngles) state.weekTheme.weekAngles = [];
    if (!state.shopHolidays) state.shopHolidays = [];
    if (!state.themeHistory) state.themeHistory = [];
    if (state.hidePresetHolidays === undefined) state.hidePresetHolidays = false;
    if (state.phase1CompleteBannerDismissed === undefined) state.phase1CompleteBannerDismissed = false;
    if (state.salonView === undefined) state.salonView = false;

    const CONTENT_ANGLES = [
      "初學者指南", "常見錯誤", "步驟清單", "工具比較", "成本比較",
      "案例分析", "前後對比", "幕後過程", "迷思破解", "反對意見",
      "最新變化", "專家觀點", "客戶問題", "個人故事", "預測"
    ];

    const SCORE_FIELDS = [
      { key: "relevance", label: "受眾相關度" },
      { key: "pain", label: "痛點強度" },
      { key: "share", label: "分享價值" },
      { key: "business", label: "商業相關度" },
      { key: "proof", label: "獨特證明" },
      { key: "effort", label: "製作難度", reverse: true }
    ];

    function downloadFile(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    }

    function exportWorkflowJson() {
      downloadFile(
        "jessi-beauty-workflow-backup.json",
        JSON.stringify({
          exportedAt: new Date().toISOString(),
          schemaVersion: WORKFLOW_SCHEMA_VERSION,
          app: "jessi-beauty-marketing-workflow",
          state
        }, null, 2),
        "application/json"
      );
    }

    function importWorkflowJsonFile(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const imported = parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
          if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
            throw new Error("JSON 必須包含 state 物件。");
          }
          if (!confirm("覆蓋現有數據？匯入後會重新載入頁面。")) return;
          saveState(imported);
          location.reload();
        } catch (error) {
          alert("JSON 匯入失敗：" + (error.message || "格式不正確"));
        }
        event.target.value = "";
      };
      reader.readAsText(file);
    }

    function syncSharedContext() {
      try {
        localStorage.setItem(SHARED_CONTEXT_KEY, JSON.stringify({
          weekTheme: {
            title: state.weekTheme?.title || "",
            kw: state.weekTheme?.kw || "",
            why: state.weekTheme?.why || "",
            weekAngles: [...(state.weekTheme?.weekAngles || [])]
          },
          weekKey: getMondayKey(),
          updatedAt: new Date().toISOString()
        }));
      } catch {
        /* ignore quota errors */
      }
    }

    function weeksBetween(weekKeyA, weekKeyB) {
      const a = new Date(weekKeyA + "T12:00:00").getTime();
      const b = new Date(weekKeyB + "T12:00:00").getTime();
      return Math.round(Math.abs(a - b) / (7 * 24 * 60 * 60 * 1000));
    }

    function recordThemeHistory(title, angles) {
      const trimmed = (title || "").trim();
      if (!trimmed) return;
      const weekKey = getMondayKey();
      const entry = {
        title: trimmed,
        weekKey,
        angles: [...(angles || state.weekTheme?.weekAngles || [])],
        kw: state.weekTheme?.kw || "",
        usedAt: weekKey
      };
      if (!state.themeHistory) state.themeHistory = [];
      const idx = state.themeHistory.findIndex((h) => h.weekKey === weekKey);
      if (idx >= 0) state.themeHistory[idx] = entry;
      else state.themeHistory.push(entry);
      saveState(state);
      renderThemeHistory();
    }

    function checkThemeRepeat(title, angles, lookbackWeeks = 8) {
      const trimmed = (title || "").trim();
      if (!trimmed) return null;
      const currentWeek = getMondayKey();
      const currentAngles = new Set(angles || state.weekTheme?.weekAngles || []);
      for (const h of (state.themeHistory || [])) {
        if (h.weekKey === currentWeek) continue;
        const gap = weeksBetween(currentWeek, h.weekKey);
        if (gap < 1 || gap > lookbackWeeks) continue;
        if (h.title !== trimmed) continue;
        const pastAngles = new Set(h.angles || []);
        const sameAngles = currentAngles.size === pastAngles.size
          && [...currentAngles].every((a) => pastAngles.has(a));
        if (sameAngles) {
          return { type: "warn", msg: `同 8 週內用過相同痛點（${h.weekKey}）` };
        }
        return { type: "info", msg: "同痛點但角度唔同，OK" };
      }
      return null;
    }

    function renderThemeRepeatWarning() {
      const title = state.weekTheme?.title || "";
      const angles = state.weekTheme?.weekAngles || [];
      const result = checkThemeRepeat(title, angles);
      ["week-theme-repeat-warn", "month-theme-repeat-warn"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!result) {
          el.hidden = true;
          el.textContent = "";
          el.className = "theme-repeat-warn";
          return;
        }
        el.hidden = false;
        el.className = `theme-repeat-warn ${result.type}`;
        el.textContent = result.msg;
      });
    }

    function renderThemeHistory() {
      const ul = document.getElementById("theme-history-list");
      const badge = document.getElementById("theme-history-count");
      const items = [...(state.themeHistory || [])]
        .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
        .slice(0, 12);
      if (badge) badge.textContent = `${items.length} 週`;
      if (!ul) return;
      ul.innerHTML = "";
      if (!items.length) {
        ul.innerHTML = "<li style=\"color:var(--muted);border:0\">未有歷史記錄</li>";
        return;
      }
      items.forEach((h) => {
        const li = document.createElement("li");
        const angles = (h.angles || []).join("、") || "—";
        li.innerHTML = `<strong>${h.weekKey}</strong> · ${h.title}<br><span style="color:var(--muted);font-size:12px">${angles}${h.kw ? " · " + h.kw : ""}</span>`;
        ul.appendChild(li);
      });
    }

    function isPhase1ChecklistComplete() {
      if (!state.checks?.["phase1-week"]) return false;
      return PHASE1_CHECK_IDS.every((id) => !!state.checks["phase1-week"][id]);
    }

    function updatePhase1CompleteBanner() {
      const banner = document.getElementById("phase1-complete-banner");
      if (!banner) return;
      const show = state.phase === "1"
        && isPhase1ChecklistComplete()
        && !state.phase1CompleteBannerDismissed;
      banner.hidden = !show;
    }

    function bindWorkflowBackupControls(exportId, importId) {
      bindOptional(exportId, "click", exportWorkflowJson);
      const importEl = document.getElementById(importId);
      if (importEl) {
        importEl.addEventListener("change", importWorkflowJsonFile);
        const label = importEl.closest("label");
        if (label) {
          label.addEventListener("click", (e) => {
            if (e.target !== importEl) importEl.click();
          });
        }
      }
    }

    function ensureContentMatrix() {
      if (!state.contentMatrix?.questions?.length) {
        state.contentMatrix = {
          questions: Array.from({ length: 10 }, (_, i) => ({
            id: "mq" + (i + 1),
            text: "",
            angles: [],
            scores: { relevance: 3, pain: 3, share: 3, business: 3, proof: 3, effort: 3 },
            cells: {},
            expanded: false,
            drawerOpen: false
          }))
        };
        saveState(state);
      }
      state.contentMatrix.questions.forEach((q) => {
        if (q.drawerOpen === undefined) q.drawerOpen = false;
      });
    }

    if (!state.matrixFilter) state.matrixFilter = "all";
    if (state.dailyDockOpen === undefined) state.dailyDockOpen = false;
    if (state.matrixActiveQ === undefined) state.matrixActiveQ = -1;

    function calcTopicScore(scores = {}) {
      const s = scores;
      const effort = Number(s.effort) || 3;
      return ["relevance", "pain", "share", "business", "proof"].reduce((sum, k) => sum + (Number(s[k]) || 0), 0) + (6 - effort);
    }

    function angleKey(angle) {
      return angle.replace(/\s/g, "_");
    }

    function cellKey(qId, angle, format) {
      return `${qId}::${angle}::${format}`;
    }

    function countMatrixUnits() {
      ensureContentMatrix();
      let total = 0;
      let done = 0;
      state.contentMatrix.questions.forEach((q) => {
        if (!q.text?.trim() || q.angles.length !== 5) return;
        q.angles.forEach((a) => {
          ["reel", "carousel"].forEach((f) => {
            total += 1;
            if (q.cells?.[cellKey(q.id, a, f)]) done += 1;
          });
        });
      });
      return { total, done };
    }

    function getSortedQuestions() {
      ensureContentMatrix();
      return [...state.contentMatrix.questions]
        .map((q, idx) => ({ q, idx, score: calcTopicScore(q.scores), hasText: !!q.text?.trim() }))
        .sort((a, b) => b.score - a.score || a.idx - b.idx);
    }

    function renderWeekAnglesGrid() {
      const grid = document.getElementById("week-angles-grid");
      if (!grid) return;
      const selected = new Set(state.weekTheme?.weekAngles || []);
      grid.innerHTML = "";
      CONTENT_ANGLES.forEach((angle) => {
        const label = document.createElement("label");
        label.className = "angle-chip";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = angle;
        cb.checked = selected.has(angle);
        cb.addEventListener("change", () => {
          const set = new Set(state.weekTheme.weekAngles || []);
          if (cb.checked) set.add(angle);
          else set.delete(angle);
          state.weekTheme.weekAngles = [...set];
          saveState(state);
          syncThemeBar();
          renderStudio();
          updateToday();
        });
        label.append(cb, document.createTextNode(angle));
        grid.appendChild(label);
      });
    }

    function renderMatrixStats() {
      const el = document.getElementById("matrix-stats");
      if (!el) return;
      const { total, done } = countMatrixUnits();
      const sorted = getSortedQuestions().filter((x) => x.hasText);
      const top = sorted[0];
      el.innerHTML = `
        <span>有效內容單位：${done}/${total || 0}</span>
        <span>已填問題：${state.contentMatrix.questions.filter((q) => q.text?.trim()).length}/10</span>
        ${top?.hasText ? `<span>最高分：Q${top.idx + 1}（${top.score}分）</span>` : ""}
      `;
    }

    function renderQuestionMatrixTable(q) {
      if (!q.text?.trim() || q.angles.length !== 5) {
        return '<p class="pending-empty" style="margin:8px 0">填好問題並揀夠 5 個角度先會展開 10 格（5×2）</p>';
      }
      let rows = "";
      q.angles.forEach((angle) => {
        ["reel", "carousel"].forEach((format) => {
          const ck = cellKey(q.id, angle, format);
          const checked = !!q.cells?.[ck];
          const fmtLabel = format === "reel" ? "Reel 短片" : "Carousel 圖文";
          rows += `<tr>
            <td>${angle}</td>
            <td>${fmtLabel}</td>
            <td><input type="checkbox" data-mx-cell="${ck}" data-mx-q="${q.id}" ${checked ? "checked" : ""}></td>
          </tr>`;
        });
      });
      return `<div class="matrix-table-wrap"><table class="matrix-table">
        <thead><tr><th>角度</th><th>格式</th><th>完成</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }

    function getMatrixQuestionProgress(q) {
      if (!q.text?.trim() || q.angles.length !== 5) return { done: 0, total: 0 };
      let done = 0;
      q.angles.forEach((a) => {
        ["reel", "carousel"].forEach((f) => {
          if (q.cells?.[cellKey(q.id, a, f)]) done += 1;
        });
      });
      return { done, total: 10 };
    }

    function matrixPassesFilter(q, score, filter) {
      const hasText = !!q.text?.trim();
      const { done, total } = getMatrixQuestionProgress(q);
      const complete = total > 0 && done === total;
      if (filter === "filled") return hasText;
      if (filter === "top") return hasText && score >= 22;
      if (filter === "incomplete") return hasText && !complete;
      return true;
    }

    function renderMatrixRankTable() {
      const tbody = document.getElementById("matrix-rank-body");
      if (!tbody) return;
      ensureContentMatrix();
      const sorted = getSortedQuestions();
      const topScore = sorted.find((x) => x.hasText)?.score ?? 0;
      tbody.innerHTML = "";
      sorted.forEach(({ q, idx, score, hasText }) => {
        const { done, total } = getMatrixQuestionProgress(q);
        const tr = document.createElement("tr");
        if (hasText && score === topScore && topScore > 0) tr.classList.add("priority");
        if (idx === state.matrixActiveQ) tr.classList.add("active");
        tr.innerHTML = `
          <td class="rank-q">Q${idx + 1}</td>
          <td class="rank-score">${score}</td>
          <td class="rank-preview ${hasText ? "has-text" : ""}">${hasText ? truncate(q.text, 36) : "（未填）"}</td>
          <td>${q.angles.length}/5</td>
          <td>${total ? `${done}/${total}` : "—"}</td>
        `;
        tr.addEventListener("click", () => openMatrixQuestion(idx));
        tbody.appendChild(tr);
      });
    }

    function openMatrixQuestion(idx) {
      ensureContentMatrix();
      state.matrixActiveQ = idx;
      state.contentMatrix.questions.forEach((q, i) => {
        q.drawerOpen = i === idx;
      });
      saveState(state);
      renderContentMatrix();
      const el = document.getElementById("mq-item-" + idx);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function renderContentMatrix() {
      ensureContentMatrix();
      const root = document.getElementById("content-matrix-root");
      if (!root) return;
      const filter = state.matrixFilter || "all";
      const sorted = getSortedQuestions();
      const topScore = sorted.find((x) => x.hasText)?.score ?? 0;
      root.innerHTML = "";

      document.querySelectorAll("[data-matrix-filter]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.matrixFilter === filter);
      });

      let shown = 0;
      state.contentMatrix.questions.forEach((q, idx) => {
        const score = calcTopicScore(q.scores);
        if (!matrixPassesFilter(q, score, filter)) return;
        shown += 1;

        const { done, total } = getMatrixQuestionProgress(q);
        const details = document.createElement("details");
        details.className = "matrix-q-item";
        details.id = "mq-item-" + idx;
        if (q.text?.trim() && score === topScore && topScore > 0) details.classList.add("priority");
        details.open = !!q.drawerOpen;

        const preview = q.text?.trim() ? truncate(q.text, 42) : "（點擊填寫受眾問題）";
        const summary = document.createElement("summary");
        summary.innerHTML = `
          <strong>Q${idx + 1}</strong>
          <span class="score-badge ${score >= 22 ? "high" : ""}">${score}分</span>
          <span class="mq-preview ${q.text?.trim() ? "" : "empty"}">${preview}</span>
          <span style="font-size:11px;color:var(--muted)">${q.angles.length}/5 · ${total ? done + "/" + total : "—"}</span>
        `;
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "matrix-q-body";

        const qInput = document.createElement("input");
        qInput.type = "text";
        qInput.placeholder = "受眾問題（例：做完護理會唔會泛紅？）";
        qInput.value = q.text || "";
        qInput.style.cssText = "width:100%;padding:10px 12px;border:2px solid var(--line);border-radius:8px;margin:8px 0";
        qInput.addEventListener("input", () => {
          q.text = qInput.value;
          saveState(state);
          renderMatrixStats();
          renderMatrixRankTable();
          const prev = summary.querySelector(".mq-preview");
          if (prev) {
            prev.textContent = q.text.trim() ? truncate(q.text, 42) : "（點擊填寫受眾問題）";
            prev.classList.toggle("empty", !q.text.trim());
          }
        });
        body.appendChild(qInput);

        const angleLabel = document.createElement("p");
        angleLabel.style.cssText = "font-size:11px;font-weight:700;margin:0 0 4px;color:var(--lavender-dark)";
        angleLabel.textContent = "揀 5 個角度";
        body.appendChild(angleLabel);

        const angleGrid = document.createElement("div");
        angleGrid.className = "angle-grid matrix-angle-grid";
        CONTENT_ANGLES.forEach((angle) => {
          const lbl = document.createElement("label");
          lbl.className = "angle-chip";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = (q.angles || []).includes(angle);
          cb.addEventListener("change", () => {
            if (!q.angles) q.angles = [];
            if (cb.checked) {
              if (q.angles.length >= 5) {
                cb.checked = false;
                showPhaseToast("每題最多 5 個角度");
                return;
              }
              q.angles.push(angle);
            } else {
              q.angles = q.angles.filter((a) => a !== angle);
            }
            saveState(state);
            renderMatrixRankTable();
            renderMatrixStats();
            const meta = summary.querySelector("span:last-child");
            if (meta) {
              const p = getMatrixQuestionProgress(q);
              meta.textContent = `${q.angles.length}/5 · ${p.total ? p.done + "/" + p.total : "—"}`;
            }
          });
          lbl.append(cb, document.createTextNode(angle));
          angleGrid.appendChild(lbl);
        });
        body.appendChild(angleGrid);

        const scoreRow = document.createElement("div");
        scoreRow.className = "score-row";
        SCORE_FIELDS.forEach((f) => {
          const lab = document.createElement("label");
          lab.textContent = f.label + (f.reverse ? "↓" : "");
          const inp = document.createElement("input");
          inp.type = "number";
          inp.min = "1";
          inp.max = "5";
          inp.value = q.scores?.[f.key] ?? 3;
          inp.addEventListener("change", () => {
            q.scores = q.scores || {};
            q.scores[f.key] = Math.min(5, Math.max(1, Number(inp.value) || 3));
            saveState(state);
            const ns = calcTopicScore(q.scores);
            const badge = summary.querySelector(".score-badge");
            if (badge) {
              badge.textContent = ns + "分";
              badge.classList.toggle("high", ns >= 22);
            }
            renderMatrixRankTable();
            renderMatrixStats();
          });
          lab.appendChild(inp);
          scoreRow.appendChild(lab);
        });
        body.appendChild(scoreRow);

        const matrixDetails = document.createElement("details");
        matrixDetails.open = !!q.expanded;
        matrixDetails.innerHTML = `<summary style="font-weight:700;cursor:pointer;margin:8px 0;font-size:12px">10 格內容單位（5×2）</summary>`;
        const inner = document.createElement("div");
        inner.innerHTML = renderQuestionMatrixTable(q);
        matrixDetails.appendChild(inner);
        matrixDetails.addEventListener("toggle", () => {
          q.expanded = matrixDetails.open;
          saveState(state);
        });
        body.appendChild(matrixDetails);

        inner.querySelectorAll("[data-mx-cell]").forEach((cb) => {
          cb.addEventListener("change", () => {
            if (!q.cells) q.cells = {};
            q.cells[cb.dataset.mxCell] = cb.checked;
            saveState(state);
            renderMatrixStats();
            renderMatrixRankTable();
            const p = getMatrixQuestionProgress(q);
            const meta = summary.querySelector("span:last-child");
            if (meta) meta.textContent = `${q.angles.length}/5 · ${p.total ? p.done + "/" + p.total : "—"}`;
          });
        });

        const setWeek = document.createElement("button");
        setWeek.type = "button";
        setWeek.className = "secondary";
        setWeek.style.marginTop = "8px";
        setWeek.textContent = "設為本週痛點";
        setWeek.addEventListener("click", () => applyMatrixQuestionToWeek(q));
        body.appendChild(setWeek);

        details.appendChild(body);
        details.addEventListener("toggle", () => {
          q.drawerOpen = details.open;
          if (details.open) state.matrixActiveQ = idx;
          saveState(state);
          renderMatrixRankTable();
        });

        root.appendChild(details);
      });

      if (!shown) {
        root.innerHTML = '<p class="pending-empty" style="padding:12px">呢個篩選冇符合嘅題目 — 試下「全部」或填寫問題。</p>';
      }
      renderMatrixStats();
      renderMatrixRankTable();
    }

    function applyMatrixQuestionToWeek(q) {
      if (!q?.text?.trim()) {
        showPhaseToast("請先填問題");
        return;
      }
      state.weekTheme.title = q.text.trim();
      state.weekTheme.weekAngles = [...(q.angles || [])];
      state.weekTheme.why = `來自 100 題矩陣（總分 ${calcTopicScore(q.scores)}）`;
      saveState(state);
      recordThemeHistory(state.weekTheme.title, state.weekTheme.weekAngles);
      syncSharedContext();
      syncThemeBar();
      renderWeekAnglesGrid();
      renderStudio();
      updateToday();
      renderMonthCalendar();
      renderThemeRepeatWarning();
      showPhaseToast("已設為本週痛點");
    }

  // ── 營銷工作台（手冊 Ch.3–14）────────────────────────────
    const STRATEGY_FIELDS = [
      { key: "goal", label: "商業目標", ph: "免費分析預約、到店成交、品牌知名度…" },
      { key: "audience", label: "核心受眾", ph: "35–49 歲女性、尖沙咀、在意輪廓鬆弛…" },
      { key: "problems", label: "受眾問題", ph: "鬆弛、斑、膚質暗、怕假、唔知次序…" },
      { key: "positioning", label: "定位句", ph: "我們幫助○○，透過○○，達到○○" },
      { key: "proof", label: "證明", ph: "儀器分析、案例、老闆經驗、客人原話…" },
      { key: "platform", label: "主平台", ph: "Instagram（Reels + Carousel + Stories）" },
      { key: "pillars", label: "內容支柱", ph: "教育、證明、觀點、人格、轉化" },
      { key: "conversion", label: "核心轉化", ph: "DM「分析」→ 免費皮膚分析 → 預約" },
      { key: "kpi", label: "KPI", ph: "查詢數、預約數、DM 數、完播/share…" },
      { key: "resources", label: "資源限制", ph: "每週外判 2 日、隔週拍攝半日…" }
    ];

    const RESEARCH_TYPES = [
      { key: "want", label: "我想要…" },
      { key: "dontWant", label: "我不想…" },
      { key: "tried", label: "我試過…" },
      { key: "worry", label: "我擔心…" },
      { key: "confused", label: "我不明白…" },
      { key: "wish", label: "如果能夠…就好了" }
    ];

    const PILLAR_OPTS = [
      { v: "education", label: "教育" },
      { v: "proof", label: "證明" },
      { v: "opinion", label: "觀點" },
      { v: "personality", label: "人格" },
      { v: "conversion", label: "轉化" }
    ];
    const PILLAR_TARGET = { education: 40, proof: 20, opinion: 15, personality: 15, conversion: 10 };

    const FUNNEL_OPTS = [
      { v: "cold", label: "陌生受眾" },
      { v: "warm", label: "有興趣" },
      { v: "hot", label: "高意向" }
    ];

    const WEEK_POSTS_DEF = [
      { id: "reel-core", label: "核心 Reel（三）" },
      { id: "carousel", label: "Carousel（四）" },
      { id: "reel2", label: "Reel#2（五）" },
      { id: "reel3", label: "Reel#3（六）" },
      { id: "stories", label: "Stories（四至六）" }
    ];

    const CTA_BY_DOW = {
      1: { tier: "低", cta: "儲存、準備下週痛點" },
      2: { tier: "中", cta: "拍攝週：幕後 / 後製週：剪片素材" },
      3: { tier: "中", cta: "儲存、分享核心 Reel" },
      4: { tier: "中", cta: "儲存 Carousel、留言回答" },
      5: { tier: "高", cta: "私訊「分析」、約免費皮膚分析" },
      6: { tier: "高", cta: "週末預約、Story CTA" },
      0: { tier: "規劃", cta: "復盤、餵下週矩陣" }
    };

    const PUBLISH_CHECKS = [
      { id: "reply", label: "30min 內回覆有內容留言" },
      { id: "insights", label: "48hr 記錄 Insights（觸及/完播/share）" },
      { id: "tracker", label: "截圖存入 tracker" },
      { id: "dm", label: "高意向留言 → 邀請 DM" }
    ];

    const SHOOT_MULTIPLEX_ITEMS = [
      { id: "sm-1", label: "3 條 Reel 主線一次拍完" },
      { id: "sm-2", label: "5–10 段 B-roll（儀器/手部/環境）" },
      { id: "sm-3", label: "2 組 Carousel 封面/內頁素材" },
      { id: "sm-4", label: "3 格 Story 素材（投票/問答/幕後）" },
      { id: "sm-5", label: "1 段分析房 trust shot" },
      { id: "sm-6", label: "1 段老闆專家觀點口播" },
      { id: "sm-7", label: "同意書 + 案例素材（如有）" }
    ];

    const SUNDAY_REVIEW_QS = [
      { key: "q1", label: "邊三個內容帶來最多合資格注意力？", wp: "wp-d0-y6" },
      { key: "q2", label: "邊個 Hook／主題／格式重複勝出？", wp: "wp-d0-y7" },
      { key: "q3", label: "邊啲只有虛榮指標、冇商業價值？", wp: "wp-d0-y8" },
      { key: "q4", label: "邊啲留言反映新需求或反對理由？", wp: "wp-d0-y9" },
      { key: "q5", label: "邊個渠道／內容帶來最高質量 Lead？", wp: "wp-d0-y10" },
      { key: "q6", label: "下週停止、繼續、加倍投入咩？", wp: "wp-d0-y11" }
    ];

    const HOOK_BUILDERS = {
      "迷思破解": (p) => `關於「${p}」，大部分人第一個信錯嘅係…`,
      "常見錯誤": (p) => `如果你正在煩「${p}」，先唔好亂試——多數人做错第一步。`,
      "初學者指南": (p) => `第一次處理「${p}」？先用 30 秒講清次序。`,
      "步驟清單": (p) => `「${p}」可以跟住做嘅 3 個步驟（由淺入深）。`,
      "案例分析": (p) => `我哋見過一位客人，佢都有「${p}」…`,
      "前後對比": (p) => `處理「${p}」之前，同之後最明顯分別係…`,
      "專家觀點": (p) => `做咗咁多年，我對「${p}」嘅觀察係…`,
      "客戶問題": (p) => `最多人 DM 問：「${p}」——今日直接答你。`,
      "反對意見": (p) => `你可能覺得「${p}」冇希望，但真相係…`,
      "個人故事": (p) => `我哋當初因為「${p}」先開始研究呢個方向…`
    };

    function defaultHook(pain, angle) {
      const fn = HOOK_BUILDERS[angle];
      if (fn) return fn(pain);
      return `大部分 30+ 女性都問：「${pain}」——用「${angle}」角度，今日講清楚。`;
    }

    function buildReelStructure(pain, angle, hook) {
      const kw = state.weekTheme?.kw || "分析";
      return `【Reel 腳本骨架｜${angle}】

Hook（0–3s）：${hook}

Context（3–8s）：如果你 30+，又關心「${pain}」，呢條係俾你。

Value（8–40s）：
· 要點 1：
· 要點 2：
· 要點 3：

Proof：儀器分析數據 / 店內案例（唔用誇大承諾）

Payoff：總結一句收返「${pain}」

CTA：想知你屬於邊種情況，DM「${kw}」約免費皮膚分析。`;
    }

    function buildCarouselOutline(pain, angle) {
      const kw = state.weekTheme?.kw || "分析";
      return `【Carousel 5 頁｜${angle}】

第 1 頁｜承諾
${angle}：「${pain}」其實可以咁處理

第 2 頁｜問題背景
點解會出現？邊啲人特別易有？

第 3 頁｜重點 1
（一個具體做法／判斷）

第 4 頁｜重點 2 + 證明
案例 / 儀器分析 / 老闆觀察

第 5 頁｜總結 + CTA
儲存呢篇 + DM「${kw}」約免費分析`;
    }

    const CURSOR_PROMPT_STRATEGY_KEYS = ["goal", "audience", "problems", "positioning", "conversion", "kpi"];

    function buildCursorPrompt() {
      ensureMarketingState();
      const pain = state.weekTheme?.title?.trim() || "";
      const angles = state.weekTheme?.weekAngles || [];
      const kw = state.weekTheme?.kw?.trim() || "分析";
      const anglesText = angles.length ? angles.join("、") : "（未設定）";
      const strategyLines = STRATEGY_FIELDS
        .filter((f) => CURSOR_PROMPT_STRATEGY_KEYS.includes(f.key))
        .map((f) => {
          const val = state.strategyCard?.[f.key]?.trim();
          return val ? `· ${f.label}：${val}` : "";
        })
        .filter(Boolean);
      const strategyBlock = strategyLines.length
        ? strategyLines.join("\n")
        : "（尚未填寫策略卡 — 可到營銷工作台補充）";

      return `【Jessi Beauty 本週內容生成｜Cursor Prompt】

## 使用方式
1. 開新 chat，**先貼入「Jessi Beauty 品牌知識庫.md」**
2. 再貼本 prompt
3. 跟 Prompt 包 1→2→3→4 順序執行（週策略 → 批量內容 → 廣東話 polish → compliance 自檢）

## 本週主題
· 痛點（生活場景）：${pain}
· 內容角度：${anglesText}
· DM 關鍵字：「${kw}」

## 策略卡摘要
${strategyBlock}

## 內容原則（必跟）
· 由生活場景出發，唔由療程技術出發
· CTA 用兩步式低門檻：共鳴 → 留言/DM 關鍵字「${kw}」→ 自測 → 30 分鐘免費皮膚分析 → WhatsApp；唔好一開波 sell
· 核心 offer = 30 分鐘免費皮膚分析（可只分析唔一定買）
· 療程名／價錢／優惠唔好太早出

## 品牌禁語提醒
· 禁用「唔係 X 而係 X」「未必 X 而係 X」呢類 AI 句式
· 太早提療程名/價/優惠、太直接銷售口吻
· 保證 / 100% / 一定有效 等保證式字眼

## 本週任務
請根據以上主題，用 Prompt 包 Prompt 1 出本週內容計劃表（Reels + Carousel + Stories），等我 approve 先行 Prompt 2。`;
    }

    function copyCursorPrompt() {
      const pain = state.weekTheme?.title?.trim();
      if (!pain) {
        showPhaseToast("請先填本週痛點");
        return;
      }
      copyText(buildCursorPrompt());
    }

    function copyText(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(
        () => showPhaseToast("已複製"),
        () => showPhaseToast("請手動複製")
      );
    }

    function ensureMarketingState() {
      if (!state.strategyCard) state.strategyCard = {};
      if (!state.audienceQuotes) {
        state.audienceQuotes = {};
        RESEARCH_TYPES.forEach((t) => { state.audienceQuotes[t.key] = []; });
      }
      if (!state.hubTab) state.hubTab = "strategy";
      ensureWeekOps();
    }

    function ensureWeekOps() {
      const key = getMondayKey();
      if (!state.weekOps || state.weekOps.weekKey !== key) {
        state.weekOps = {
          weekKey: key,
          posts: WEEK_POSTS_DEF.map((p) => ({ ...p, pillar: "", funnel: "cold" })),
          postPublish: {},
          shootMultiplex: {},
          sundayReview: {}
        };
        saveState(state);
      }
    }

    function setHubTab(tab) {
      state.hubTab = tab;
      saveState(state);
      document.querySelectorAll("[data-hub-tab]").forEach((btn) => {
        const on = btn.dataset.hubTab === tab;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll(".hub-panel").forEach((panel) => {
        const on = panel.id === "hub-panel-" + tab;
        panel.classList.toggle("active", on);
        panel.hidden = !on;
      });
    }

    function renderStrategyForm() {
      const form = document.getElementById("strategy-form");
      if (!form || form.dataset.ready) return;
      form.dataset.ready = "1";
      form.innerHTML = "";
      STRATEGY_FIELDS.forEach((f) => {
        const lab = document.createElement("label");
        lab.textContent = f.label;
        const inp = document.createElement(f.key === "positioning" || f.key === "problems" ? "textarea" : "input");
        if (inp.tagName === "TEXTAREA") inp.rows = 2;
        else inp.type = "text";
        inp.placeholder = f.ph;
        inp.value = state.strategyCard[f.key] || "";
        inp.dataset.strategyKey = f.key;
        inp.addEventListener("input", () => {
          state.strategyCard[f.key] = inp.value;
          saveState(state);
        });
        lab.appendChild(inp);
        form.appendChild(lab);
      });
    }

    function addAudienceQuote(typeKey, text) {
      if (!text?.trim()) return;
      ensureMarketingState();
      const arr = state.audienceQuotes[typeKey] || [];
      arr.unshift({ id: "q" + Date.now(), text: text.trim() });
      state.audienceQuotes[typeKey] = arr.slice(0, 20);
      saveState(state);
      renderResearchGrid();
    }

    function sendQuoteToMatrix(text) {
      ensureContentMatrix();
      const empty = state.contentMatrix.questions.findIndex((q) => !q.text?.trim());
      const idx = empty >= 0 ? empty : 0;
      state.contentMatrix.questions[idx].text = text;
      saveState(state);
      renderContentMatrix();
      showPhaseToast(`已送入矩陣 Q${idx + 1}`);
      document.getElementById("content-matrix")?.scrollIntoView({ behavior: "smooth" });
    }

    function renderResearchGrid() {
      const grid = document.getElementById("research-grid");
      if (!grid) return;
      ensureMarketingState();
      grid.innerHTML = "";
      RESEARCH_TYPES.forEach((t) => {
        const col = document.createElement("div");
        col.className = "research-col";
        col.innerHTML = `<h4>${t.label}</h4>`;
        const ul = document.createElement("ul");
        ul.className = "quote-list";
        (state.audienceQuotes[t.key] || []).forEach((item) => {
          const li = document.createElement("li");
          const span = document.createElement("span");
          span.textContent = item.text;
          span.style.flex = "1";
          const toMx = document.createElement("button");
          toMx.type = "button";
          toMx.className = "secondary";
          toMx.textContent = "→矩陣";
          toMx.addEventListener("click", () => sendQuoteToMatrix(item.text));
          const del = document.createElement("button");
          del.type = "button";
          del.className = "secondary";
          del.textContent = "×";
          del.addEventListener("click", () => {
            state.audienceQuotes[t.key] = state.audienceQuotes[t.key].filter((x) => x.id !== item.id);
            saveState(state);
            renderResearchGrid();
          });
          li.append(span, toMx, del);
          ul.appendChild(li);
        });
        col.appendChild(ul);
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "6px";
        const inp = document.createElement("input");
        inp.placeholder = "貼原話…";
        inp.style.flex = "1";
        inp.style.padding = "6px 8px";
        inp.style.border = "2px solid var(--line)";
        inp.style.borderRadius = "6px";
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "+";
        add.addEventListener("click", () => {
          addAudienceQuote(t.key, inp.value);
          inp.value = "";
        });
        row.append(inp, add);
        col.appendChild(row);
        grid.appendChild(col);
      });
    }

    function renderStudio() {
      const root = document.getElementById("studio-angles-root");
      const ctx = document.getElementById("studio-context");
      const cursorBtn = document.getElementById("studio-copy-cursor-prompt");
      if (!root) return;
      const pain = state.weekTheme?.title?.trim() || "";
      if (cursorBtn) cursorBtn.disabled = !pain;
      const angles = state.weekTheme?.weekAngles?.length
        ? state.weekTheme.weekAngles
        : CONTENT_ANGLES.slice(0, 3);
      if (ctx) ctx.textContent = pain ? `痛點：${pain}` : "痛點：（未設定 — 請先填本週痛點）";
      root.innerHTML = "";
      if (!pain) {
        root.innerHTML = '<p class="pending-empty">請先喺月曆或主題發掘填「本週痛點」。</p>';
        return;
      }
      angles.forEach((angle) => {
        const hook = defaultHook(pain, angle);
        const card = document.createElement("div");
        card.className = "studio-angle-card";
        card.innerHTML = `<h4>${angle}</h4>`;
        const hookPre = document.createElement("pre");
        hookPre.className = "copy-block";
        hookPre.style.marginTop = "0";
        hookPre.textContent = hook;
        card.appendChild(hookPre);
        const row = document.createElement("div");
        row.className = "copy-row";
        const b1 = document.createElement("button");
        b1.type = "button";
        b1.textContent = "複製 Hook";
        b1.addEventListener("click", () => copyText(hook));
        const b2 = document.createElement("button");
        b2.type = "button";
        b2.className = "secondary";
        b2.textContent = "複製 Reel 骨架";
        b2.addEventListener("click", () => copyText(buildReelStructure(pain, angle, hook)));
        const b3 = document.createElement("button");
        b3.type = "button";
        b3.className = "secondary";
        b3.textContent = "複製 Carousel 5 頁";
        b3.addEventListener("click", () => copyText(buildCarouselOutline(pain, angle)));
        row.append(b1, b2, b3);
        card.appendChild(row);
        root.appendChild(card);
      });
    }

    function calcPillarMix() {
      ensureWeekOps();
      const counts = { education: 0, proof: 0, opinion: 0, personality: 0, conversion: 0 };
      let total = 0;
      state.weekOps.posts.forEach((p) => {
        if (p.pillar && counts[p.pillar] !== undefined) {
          counts[p.pillar] += 1;
          total += 1;
        }
      });
      const pct = {};
      Object.keys(counts).forEach((k) => {
        pct[k] = total ? Math.round((counts[k] / total) * 100) : 0;
      });
      return { counts, pct, total };
    }

    function renderWeekPlan() {
      const body = document.getElementById("week-plan-body");
      const bars = document.getElementById("pillar-mix-bars");
      const ctaGrid = document.getElementById("cta-day-grid");
      if (!body) return;
      ensureWeekOps();
      body.innerHTML = "";
      state.weekOps.posts.forEach((post, i) => {
        const tr = document.createElement("tr");
        const td0 = document.createElement("td");
        td0.textContent = post.label;
        const td1 = document.createElement("td");
        const selP = document.createElement("select");
        selP.innerHTML = '<option value="">—</option>' + PILLAR_OPTS.map((o) =>
          `<option value="${o.v}">${o.label}</option>`).join("");
        selP.value = post.pillar || "";
        selP.addEventListener("change", () => {
          state.weekOps.posts[i].pillar = selP.value;
          saveState(state);
          renderWeekPlan();
        });
        td1.appendChild(selP);
        const td2 = document.createElement("td");
        const selF = document.createElement("select");
        selF.innerHTML = FUNNEL_OPTS.map((o) =>
          `<option value="${o.v}">${o.label}</option>`).join("");
        selF.value = post.funnel || "cold";
        selF.addEventListener("change", () => {
          state.weekOps.posts[i].funnel = selF.value;
          saveState(state);
        });
        td2.appendChild(selF);
        tr.append(td0, td1, td2);
        body.appendChild(tr);
      });
      if (bars) {
        const { pct } = calcPillarMix();
        bars.innerHTML = "";
        PILLAR_OPTS.forEach((o) => {
          const row = document.createElement("div");
          row.className = "mix-bar-row";
          row.innerHTML = `
            <span>${o.label}</span>
            <div class="mix-bar-track"><div style="width:${pct[o.v]}%"></div></div>
            <span>${pct[o.v]}%</span>
            <span class="mix-bar-target">${PILLAR_TARGET[o.v]}%</span>
          `;
          bars.appendChild(row);
        });
      }
      if (ctaGrid) {
        const today = new Date().getDay();
        ctaGrid.innerHTML = "";
        [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
          const info = CTA_BY_DOW[d];
          const card = document.createElement("div");
          card.className = "cta-day-card" + (d === today ? " today" : "");
          card.innerHTML = `<strong>星期${DAY_NAMES[d]}</strong><span style="color:var(--muted)">${info.tier}</span><br>${info.cta}`;
          ctaGrid.appendChild(card);
        });
      }
    }

    function renderPostPublish() {
      const root = document.getElementById("post-publish-root");
      if (!root) return;
      ensureWeekOps();
      root.innerHTML = "";
      WEEK_POSTS_DEF.forEach((post) => {
        const box = document.createElement("div");
        box.className = "publish-asset";
        box.innerHTML = `<h4>${post.label}</h4>`;
        const ul = document.createElement("ul");
        ul.className = "checklist";
        PUBLISH_CHECKS.forEach((chk) => {
          const id = `pp-${post.id}-${chk.id}`;
          const key = `${post.id}::${chk.id}`;
          const li = document.createElement("li");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.id = id;
          cb.checked = !!state.weekOps.postPublish[key];
          const label = document.createElement("label");
          label.htmlFor = id;
          label.textContent = chk.label;
          cb.addEventListener("change", () => {
            state.weekOps.postPublish[key] = cb.checked;
            saveState(state);
          });
          li.append(cb, label);
          ul.appendChild(li);
        });
        box.appendChild(ul);
        root.appendChild(box);
      });
    }

    function renderSundayReview() {
      const root = document.getElementById("sunday-review-root");
      if (!root) return;
      ensureWeekOps();
      root.innerHTML = "";
      SUNDAY_REVIEW_QS.forEach((q) => {
        const wrap = document.createElement("div");
        wrap.className = "review-q";
        const lab = document.createElement("label");
        lab.textContent = q.label;
        const ta = document.createElement("textarea");
        ta.placeholder = "簡答…（可貼 tracker 數據）";
        ta.value = state.weekOps.sundayReview[q.key] || "";
        ta.addEventListener("input", () => {
          state.weekOps.sundayReview[q.key] = ta.value;
          saveState(state);
        });
        wrap.append(lab, ta);
        root.appendChild(wrap);
      });
    }

    function renderShootMultiplex() {
      const ul = document.getElementById("shoot-multiplex-list");
      const panel = document.getElementById("shoot-multiplex-panel");
      const pctEl = document.getElementById("shoot-multiplex-pct");
      if (!ul || !panel) return;
      const shoot = isShootWeek();
      panel.hidden = !shoot;
      if (!shoot) return;
      ensureWeekOps();
      ul.innerHTML = "";
      let done = 0;
      SHOOT_MULTIPLEX_ITEMS.forEach((item) => {
        const li = document.createElement("li");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = item.id;
        cb.checked = !!state.weekOps.shootMultiplex[item.id];
        if (cb.checked) done += 1;
        const label = document.createElement("label");
        label.htmlFor = item.id;
        label.textContent = item.label;
        cb.addEventListener("change", () => {
          state.weekOps.shootMultiplex[item.id] = cb.checked;
          saveState(state);
          renderShootMultiplex();
        });
        li.append(cb, label);
        ul.appendChild(li);
      });
      if (pctEl) pctEl.textContent = `${done}/${SHOOT_MULTIPLEX_ITEMS.length}`;
    }

    function renderMarketingHub() {
      ensureMarketingState();
      renderStrategyForm();
      renderResearchGrid();
      renderStudio();
      renderWeekPlan();
      renderPostPublish();
      renderSundayReview();
      renderShootMultiplex();
      setHubTab(state.hubTab || "strategy");
    }

    document.getElementById("hub-tabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hub-tab]");
      if (btn?.dataset?.hubTab) setHubTab(btn.dataset.hubTab);
    });
    bindOptional("studio-copy-cursor-prompt", "click", copyCursorPrompt);

    function isShootWeek(date = new Date()) {
      const start = new Date(state.shootAnchor + "T12:00:00");
      const weeks = Math.floor((date - start) / (7 * 86400000));
      return weeks % 2 === 0;
    }

    function truncate(s, n = 28) {
      if (!s) return "未設定痛點";
      return s.length > n ? s.slice(0, n) + "…" : s;
    }

    function formatWeekAngles(angles, max = 2) {
      if (!angles?.length) return "";
      if (angles.length <= max) return angles.join("·");
      return angles.slice(0, max).join("·") + "…";
    }

    const WEEK_TASKS = [
      {
        day: 1, label: "一",
        groups: [
          { who: "you", items: [
            { id: "wp-d1-y1", label: "Tracker 上週復盤" },
            { id: "wp-d1-y2", label: "抄本週內容日程 + shot list", phase: "1" },
            { id: "wp-d1-y3", label: "主題發掘 + 揀本週題", phase: "2" },
            { id: "wp-d1-y4", label: "Prompt 1–4 出腳本/Reel 稿", phase: "2" },
            { id: "wp-d1-y5", label: "Campaign Brief + 交客服話術" },
            { id: "wp-d1-y6", label: "DM 30–45min" }
          ]},
          { who: "salon", items: [
            { id: "wp-d1-s1", label: "Confirm 本週主題/講法/空檔" },
            { id: "wp-d1-s2", label: "確認出街前 48hr 審批 deadline" }
          ]}
        ]
      },
      {
        day: 2, label: "二",
        groups: [
          { who: "you", items: [
            { id: "wp-d2-y1", label: "拍攝半日（3 Reel + 素材）", shoot: "yes" },
            { id: "wp-d2-y2", label: "剪片 / 補 B-roll", shoot: "no" },
            { id: "wp-d2-y3", label: "DM 30–45min" }
          ]},
          { who: "salon", items: [
            { id: "wp-d2-s1", label: "老闆出鏡、場地、同意書", shoot: "yes" },
            { id: "wp-d2-s2", label: "交 3–5 條手機素材", shoot: "no" }
          ]}
        ]
      },
      {
        day: 3, label: "三",
        groups: [
          { who: "you", items: [
            { id: "wp-d3-y1", label: "後製 3–4hr（剪片 + 字幕）" },
            { id: "wp-d3-y2", label: "Canva Carousel + 排程本週" },
            { id: "wp-d3-y3", label: "今晚出核心 Reel" },
            { id: "wp-d3-y4", label: "DM 30–45min" }
          ]},
          { who: "salon", items: [
            { id: "wp-d3-s1", label: "審批本週內容（如有需要）" }
          ]}
        ]
      },
      {
        day: 4, label: "四",
        groups: [
          { who: "you", items: [
            { id: "wp-d4-y1", label: "Carousel 出街" },
            { id: "wp-d4-y2", label: "Story 1–2 格" },
            { id: "wp-d4-y3", label: "DM 30–45min" }
          ]},
          { who: "salon", items: [
            { id: "wp-d4-s1", label: "回 DM" },
            { id: "wp-d4-s2", label: "確認週末空檔" }
          ]}
        ]
      },
      {
        day: 5, label: "五",
        groups: [
          { who: "you", items: [
            { id: "wp-d5-y1", label: "Reel#2 出街" },
            { id: "wp-d5-y2", label: "Story 問答" },
            { id: "wp-d5-y3", label: "收 5 個數 → tracker → 週報" },
            { id: "wp-d5-y4", label: "DM 30–45min" }
          ]},
          { who: "salon", items: [
            { id: "wp-d5-s1", label: "18:00 前交週報（5 數 + FAQ）" }
          ]}
        ]
      },
      {
        day: 6, label: "六",
        groups: [
          { who: "you", items: [
            { id: "wp-d6-y1", label: "Reel#3 出街" },
            { id: "wp-d6-y2", label: "即場 Story + 免費分析 CTA" },
            { id: "wp-d6-y3", label: "DM 30–45min" }
          ]},
          { who: "salon", items: [
            { id: "wp-d6-s1", label: "即場素材" },
            { id: "wp-d6-s2", label: "跟進週末預約" }
          ]}
        ]
      },
      { day: 0, label: "日", shopClosed: true,
        note: "店休 — 你負責 tracker、數據分析、DM",
        groups: [
          { who: "you", items: [
            { id: "wp-d0-y1", label: "Tracker 本週數據整理（內容/DM/lead）" },
            { id: "wp-d0-y2", label: "數據分析：邊條有效、轉換、下週主題線索" },
            { id: "wp-d0-y3", label: "更新 backlog（保留強題、淘汰弱題）" },
            { id: "wp-d0-y4", label: "DM 全覆（星期日你負責）" },
            { id: "wp-d0-y5", label: "檢查下週排程 + 標記店休日調整" },
            { id: "wp-d0-y6", label: "復盤①：邊三條內容最有效？" },
            { id: "wp-d0-y7", label: "復盤②：邊個 Hook／格式贏？" },
            { id: "wp-d0-y8", label: "復盤③：邊啲只有虛榮指標？" },
            { id: "wp-d0-y9", label: "復盤④：新留言／反對理由？" },
            { id: "wp-d0-y10", label: "復盤⑤：最高質量 Lead 來源？" },
            { id: "wp-d0-y11", label: "復盤⑥：下週停/繼續/加倍？" }
          ]}
        ]
      }
    ];

    const WEEK_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

    const HOLIDAY_TIPS = {
      1: "主題/Brief 改下一個工作天；可先做 Tracker 復盤",
      2: "拍攝改期；可剪片 / 排程（在家做）",
      3: "後製 & 排程照常；核心 Reel 可照出街",
      4: "Carousel / Story 照出街",
      5: "收 5 個數改下一個工作天（提醒店內）",
      6: "Reel / 週末 CTA 照出街"
    };

    let viewMonthYear = new Date().getFullYear();
    let viewMonthIdx = new Date().getMonth();

    function toDateKey(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function getCalendarWorkLines(dow, phase, shoot) {
      const p = phase === "1" ? "1" : "2";
      const lines = {
        0: ["Tracker", "數據分析", "DM"],
        1: p === "1" ? ["復盤", "抄日程", "Brief"] : ["復盤", "主題", "腳本"],
        2: shoot ? ["拍攝半日", "3 Reel"] : ["剪片", "B-roll"],
        3: ["後製", "Carousel", "排程"],
        4: ["Carousel", "Story", "DM"],
        5: ["Reel#2", "收5數", "週報"],
        6: ["Reel#3", "週末CTA", "DM"]
      };
      return lines[dow] || [];
    }

    const DAILY_PREP = {
      0: {
        title: "聽日（一）準備",
        items: [
          { id: "prep-sun-1", label: "Tracker 上週數據整理好（復盤用）" },
          { id: "prep-sun-2", label: "主題發掘：backlog 候選 / 發掘線索", phase: "2" },
          { id: "prep-sun-3", label: "開內容日程 W? + shot list 草稿", phase: "1" },
          { id: "prep-sun-4", label: "Prompt 1–4 參考資料 ready", phase: "2" }
        ]
      },
      1: {
        title: "聽日（二）準備",
        items: [
          { id: "prep-mon-1", label: "shot list 已印／開好" },
          { id: "prep-mon-2", label: "Campaign Brief 已交店內" },
          { id: "prep-mon-3", label: "拍攝週：器材 + 同意書 + 老闆 confirm", shoot: "yes" },
          { id: "prep-mon-4", label: "後製週：提醒店內交素材時間", shoot: "no" }
        ]
      },
      2: {
        title: "聽日（三）準備",
        items: [
          { id: "prep-tue-1", label: "拍攝素材已備份（上雲／本地）", shoot: "yes" },
          { id: "prep-tue-2", label: "剪片素材齊、開工程檔", shoot: "no" },
          { id: "prep-tue-3", label: "核心 Reel 剪輯順序定好" }
        ]
      },
      3: {
        title: "聽日（四）準備",
        items: [
          { id: "prep-wed-1", label: "Carousel 逐頁圖 export ready" },
          { id: "prep-wed-2", label: "Story 草稿（1–2 格）" },
          { id: "prep-wed-3", label: "核心 Reel 已排程出街" }
        ]
      },
      4: {
        title: "聽日（五）準備",
        items: [
          { id: "prep-thu-1", label: "Reel#2 已排程" },
          { id: "prep-thu-2", label: "tracker 週五欄位開好（收5數）" }
        ]
      },
      5: {
        title: "聽日（六）準備",
        items: [
          { id: "prep-fri-1", label: "週報已發（或 draft ready）" },
          { id: "prep-fri-2", label: "Reel#3 + 週末 CTA 文案 ready" }
        ]
      },
      6: {
        title: "聽日（日）準備",
        items: [
          { id: "prep-sat-1", label: "本週內容成效截圖入 tracker" },
          { id: "prep-sat-2", label: "DM 本週關鍵字／客人原話記錄" },
          { id: "prep-sat-3", label: "檢查下週排程 + 標記店休日" }
        ]
      }
    };

    function prepItemVisible(item, phase, shoot) {
      if (item.phase && item.phase !== phase) return false;
      if (item.shoot === "yes" && !shoot) return false;
      if (item.shoot === "no" && shoot) return false;
      return true;
    }

    function getDisplacedWork(dateKey) {
      const d = new Date(dateKey + "T12:00:00");
      const dow = d.getDay();
      if (!isPublicHoliday(dateKey) || dow === 0) return [];
      const shoot = isShootWeek(d);
      const phase = state.phase === "1" ? "1" : "2";
      const items = [];
      if (dow === 1) items.push({ type: "mon", label: phase === "1" ? "抄日程日" : "主題/Brief 日" });
      if (dow === 2) items.push({ type: "tue", label: shoot ? "拍攝日" : "店內出鏡/素材日" });
      if (dow === 3) items.push({ type: "wed", label: "店內審批日" });
      if (dow === 5) items.push({ type: "fri", label: "收 5 個數日" });
      if (dow === 4 || dow === 6) items.push({ type: "dm", label: "店內回 DM" });
      return items;
    }

    function collectPendingItems(year, monthIdx) {
      const items = [];
      const last = new Date(year, monthIdx + 1, 0, 12, 0, 0);
      for (let day = 1; day <= last.getDate(); day++) {
        const d = new Date(year, monthIdx, day, 12, 0, 0);
        const key = toDateKey(d);
        getDisplacedWork(key).forEach((w) => {
          const id = `pend-${key}-${w.type}`;
          items.push({
            id,
            dateKey: key,
            label: `${formatShortDate(d)}（${DAY_NAMES[d.getDay()]}）${w.label}`
          });
        });
      }
      return items;
    }

    function ensureDailyPrep() {
      const key = toDateKey(new Date());
      if (!state.dailyPrep || state.dailyPrep.dateKey !== key) {
        state.dailyPrep = { dateKey: key, checks: {} };
        saveState(state);
      }
    }

    if (!state.pendingChecks) state.pendingChecks = {};
    if (!state.m1Week) state.m1Week = "";

    function renderMonthCalendar() {
      const grid = document.getElementById("month-cal-grid");
      const label = document.getElementById("month-label");
      if (!grid || !label) return;
      const phase = state.phase === "1" ? "1" : "2";
      const todayKey = toDateKey(new Date());
      label.textContent = `${viewMonthYear}年${viewMonthIdx + 1}月`;
      grid.querySelectorAll(".cal-cell").forEach((el) => el.remove());

      const first = new Date(viewMonthYear, viewMonthIdx, 1, 12, 0, 0);
      const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
      const cursor = new Date(first);
      cursor.setDate(cursor.getDate() - startPad);

      for (let i = 0; i < 42; i++) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() + i);
        const key = toDateKey(d);
        const dow = d.getDay();
        const inMonth = d.getMonth() === viewMonthIdx;
        const shoot = isShootWeek(d);
        const pubHol = isPublicHoliday(key);
        const sunday = dow === 0;
        const lines = getCalendarWorkLines(dow, phase, shoot);

        const cell = document.createElement("div");
        cell.className = "cal-cell";
        if (!inMonth) cell.classList.add("other-month");
        if (sunday) cell.classList.add("sunday");
        if (pubHol) cell.classList.add("holiday");
        if (shoot && inMonth) cell.classList.add("shoot-week");
        if (shoot && dow === 2 && inMonth) cell.classList.add("shoot-day");
        if (key === todayKey) cell.classList.add("today");

        const tags = [];
        if (pubHol) tags.push(`<span class="cal-cell-tag hol" title="${getHolidayNote(key)}">${shortHolidayTag(getHolidayNote(key))}</span>`);
        else if (sunday) tags.push(`<span class="cal-cell-tag hol">店休</span>`);
        else if (shoot && dow === 2) tags.push(`<span class="cal-cell-tag shoot">拍攝</span>`);

        const theme = state.weekTheme?.title || "";
        const monKey = getMondayKey(d);
        const thisWeekMon = getMondayKey(new Date());
        const showTheme = theme && monKey === thisWeekMon && dow === 1 && inMonth;
        const m1Tag = state.phase === "1" && state.m1Week && monKey === thisWeekMon && dow === 1 && inMonth
          ? `M1 W${state.m1Week}` : "";

        cell.innerHTML = `
          <div class="cal-cell-num">
            <span>${d.getDate()}</span>
            <span>${tags.join("")}</span>
          </div>
          <div class="cal-cell-lines">
            ${m1Tag ? `<strong>${m1Tag}</strong><br>` : ""}
            ${showTheme ? `<strong>${truncate(theme, 16)}</strong><br>` : ""}
            ${lines.map((l) => l).join(" · ")}
          </div>
        `;
        grid.appendChild(cell);
      }
      renderPendingList();
    }

    function renderPendingList() {
      const ul = document.getElementById("pending-list");
      if (!ul) return;
      const items = collectPendingItems(viewMonthYear, viewMonthIdx);
      ul.innerHTML = "";
      if (!items.length) {
        ul.innerHTML = '<li class="pending-empty" style="border:0">本月無公眾假期撞期 — 或尚未設定店休日</li>';
        return;
      }
      items.forEach((item) => {
        const done = !!state.pendingChecks[item.id];
        const li = document.createElement("li");
        if (done) li.classList.add("done");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = item.id;
        cb.checked = done;
        const label = document.createElement("label");
        label.htmlFor = item.id;
        label.textContent = item.label + " — 待安排";
        cb.addEventListener("change", () => {
          state.pendingChecks[item.id] = cb.checked;
          saveState(state);
          li.classList.toggle("done", cb.checked);
        });
        li.append(cb, label);
        ul.appendChild(li);
      });
    }

    function updateDailyPrepStats() {
      const ul = document.getElementById("daily-prep-list");
      const pctEl = document.getElementById("daily-prep-pct");
      const panel = document.getElementById("daily-prep-panel-wp");
      if (!ul || !pctEl) return;
      const boxes = ul.querySelectorAll('input[type="checkbox"]');
      const done = [...boxes].filter((cb) => cb.checked).length;
      const total = boxes.length;
      pctEl.textContent = total ? `${done}/${total}` : "0/0";
      const title = document.getElementById("daily-prep-title")?.textContent || "";
      const sumLabel = document.getElementById("daily-prep-summary-label");
      if (sumLabel && title !== "—") sumLabel.textContent = `今晚準備 · ${title}`;
      if (panel && total && done === total) panel.removeAttribute("open");
    }

    function renderDailyPrep() {
      ensureDailyPrep();
      const ul = document.getElementById("daily-prep-list");
      const title = document.getElementById("daily-prep-title");
      const hint = document.getElementById("daily-prep-hint");
      if (!ul || !title) return;
      const now = new Date();
      const dow = now.getDay();
      const phase = state.phase === "1" ? "1" : "2";
      const shoot = isShootWeek(now);
      const prep = DAILY_PREP[dow];
      if (!prep) return;
      title.textContent = prep.title;
      if (hint) {
        hint.textContent = dow === 0
          ? "星期日做好星期一準備 — 復盤數據、主題選項、腳本／Reel 稿先 ready。"
          : "今晚 check 完 — 聽日開工唔使諗。";
      }
      ul.innerHTML = "";
      prep.items.filter((item) => prepItemVisible(item, phase, shoot)).forEach((item) => {
        const li = document.createElement("li");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = item.id;
        cb.checked = !!state.dailyPrep.checks[item.id];
        const label = document.createElement("label");
        label.htmlFor = item.id;
        label.textContent = item.label;
        cb.addEventListener("change", () => {
          ensureDailyPrep();
          state.dailyPrep.checks[item.id] = cb.checked;
          saveState(state);
          updateDailyPrepStats();
        });
        li.append(cb, label);
        ul.appendChild(li);
      });
      updateDailyPrepStats();
    }

    function renderMonthSchedule() {
      renderMonthCalendar();
      renderDailyPrep();
      syncThemeBar();
    }

    function syncThemeBar() {
      const monthTitle = document.getElementById("month-theme-title");
      const weekTitle = document.getElementById("week-theme-title");
      const note = document.getElementById("month-theme-note");
      const hint = document.getElementById("theme-bar-hint");
      const m1 = document.getElementById("m1-week-num");
      if (monthTitle && document.activeElement !== monthTitle) {
        monthTitle.value = state.weekTheme?.title || "";
      }
      if (weekTitle && document.activeElement !== weekTitle) {
        weekTitle.value = state.weekTheme?.title || "";
      }
      if (note && document.activeElement !== note) {
        const parts = [];
        const angles = state.weekTheme?.weekAngles || [];
        if (angles.length) parts.push("角度：" + angles.join("、"));
        if (state.weekTheme?.kw) parts.push("關鍵字：" + state.weekTheme.kw);
        if (state.weekTheme?.why) parts.push(state.weekTheme.why);
        note.value = parts.join(" · ") || "";
      }
      if (m1) m1.value = state.m1Week || "";
      if (hint) {
        const t = state.weekTheme?.title;
        const angles = state.weekTheme?.weekAngles || [];
        const w = state.m1Week;
        if (state.phase === "1" && w) hint.textContent = `而家做緊 M1 ${w} — ${t || "未填痛點"}`;
        else if (t && angles.length) hint.textContent = `痛點：${truncate(t, 36)}｜角度：${formatWeekAngles(angles, 3)}`;
        else if (t) hint.textContent = `本週痛點：${t}`;
        else hint.textContent = "痛點＝一個受眾問題；角度＝點樣拆內容。填好後月曆同頂部 pill 會顯示。";
      }
    }

    function syncThemeFromBar() {
      const title = document.getElementById("month-theme-title")?.value.trim()
        || document.getElementById("week-theme-title")?.value.trim() || "";
      const note = document.getElementById("month-theme-note")?.value.trim() || "";
      state.weekTheme = state.weekTheme || {};
      state.weekTheme.title = title;
      if (note && !state.weekTheme.why) state.weekTheme.why = note;
      saveState(state);
      recordThemeHistory(state.weekTheme.title, state.weekTheme.weekAngles);
      syncSharedContext();
      syncThemeBar();
      renderWeekAnglesGrid();
      renderStudio();
      updateToday();
      renderMonthCalendar();
      renderThemeRepeatWarning();
    }

    function getDayConfig(dayDow) {
      return WEEK_TASKS.find((d) => d.day === dayDow);
    }

    function getDateKeyForWeekday(dayDow, mon = getMondayDate()) {
      const d = new Date(mon);
      if (dayDow === 0) d.setDate(d.getDate() + 6);
      else d.setDate(d.getDate() + dayDow - 1);
      return d.toISOString().slice(0, 10);
    }

    function isSundayDate(dateKey) {
      return new Date(dateKey + "T12:00:00").getDay() === 0;
    }

    function isPublicHoliday(dateKey) {
      if ((state.shopHolidays || []).some((h) => h.date === dateKey)) return true;
      if (state.hidePresetHolidays) return false;
      return !!HK_PUBLIC_HOLIDAYS_2026[dateKey];
    }

    function isShopClosed(dateKey) {
      return isSundayDate(dateKey) || isPublicHoliday(dateKey);
    }

    function getHolidayNote(dateKey) {
      const custom = (state.shopHolidays || []).find((x) => x.date === dateKey);
      if (custom?.note) return custom.note;
      if (!state.hidePresetHolidays && HK_PUBLIC_HOLIDAYS_2026[dateKey]) {
        return HK_PUBLIC_HOLIDAYS_2026[dateKey];
      }
      return "公眾假期";
    }

    function shortHolidayTag(note) {
      const map = {
        "香港特別行政區成立紀念日": "七一",
        "香港特區成立紀念日": "七一",
        "耶穌受難節翌日": "受難節翌日",
        "清明節翌日": "清明翌日",
        "復活節星期一翌日": "復活節翌日",
        "佛誕翌日": "佛誕翌日",
        "中秋節翌日": "中秋翌日",
        "重陽節翌日": "重陽翌日",
        "聖誕節後第一個周日": "聖誕後"
      };
      if (map[note]) return map[note];
      return note.length > 5 ? note.slice(0, 4) + "…" : note;
    }

    function getTasksForDay(dayConfig, phase, shoot) {
      if (!dayConfig?.groups) return { tasks: [], dateKey: "", closed: false, pubHol: false };
      const dateKey = getDateKeyForWeekday(dayConfig.day);
      const closed = isShopClosed(dateKey);
      const pubHol = isPublicHoliday(dateKey);
      const ctx = { closed, pubHol };
      const tasks = [];

      dayConfig.groups.forEach((group) => {
        if (group.who === "salon" && closed) return;
        group.items.forEach((item) => {
          if (taskVisible(item, phase, shoot, ctx)) {
            tasks.push({ ...item, who: group.who, day: dayConfig.day, dateKey });
          }
        });
      });

      if (pubHol && !isSundayDate(dateKey)) {
        if (dayConfig.day === 1) {
          tasks.push({ id: "wp-h-mon", label: "主題/Brief 改下一工作天（或電話 confirm）", who: "you", day: 1, dateKey });
        }
        if (dayConfig.day === 2 && shoot) {
          tasks.push({ id: "wp-h-tue-shoot", label: "拍攝改期 — WhatsApp 老闆", who: "you", day: 2, dateKey });
        }
        if (dayConfig.day === 5) {
          tasks.push({ id: "wp-h-fri", label: "提醒店內下一工作日交 5 個數", who: "you", day: 5, dateKey });
        }
      }

      return { tasks, dateKey, closed, pubHol };
    }

    function getMondayDate(d = new Date()) {
      const date = new Date(d);
      date.setHours(12, 0, 0, 0);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      return date;
    }

    function getMondayKey(d = new Date()) {
      return getMondayDate(d).toISOString().slice(0, 10);
    }

    function formatShortDate(d) {
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }

    function ensureWeekProgress() {
      const key = getMondayKey();
      if (!state.weekProgress || state.weekProgress.weekKey !== key) {
        state.weekProgress = { weekKey: key, checks: {} };
        saveState(state);
      }
    }

    function taskVisible(item, phase, shoot, ctx = {}) {
      if (item.phase && item.phase !== phase) return false;
      if (ctx.closed && item.shoot === "yes") return false;
      if (item.shoot === "yes" && !shoot) return false;
      if (item.shoot === "no" && shoot && !ctx.closed) return false;
      return true;
    }

    function collectVisibleTasks(phase, shoot, whoFilter) {
      const all = [];
      WEEK_DAY_ORDER.forEach((dayDow) => {
        const day = getDayConfig(dayDow);
        if (!day) return;
        getTasksForDay(day, phase, shoot).tasks.forEach((t) => {
          if (!whoFilter || t.who === whoFilter) all.push(t);
        });
      });
      return all;
    }

    function renderHolidayList() {
      const ul = document.getElementById("holiday-list");
      const badge = document.getElementById("holiday-count-badge");
      const sorted = [...(state.shopHolidays || [])].sort((a, b) => a.date.localeCompare(b.date));
      if (badge) {
        badge.textContent = sorted.length
          ? `${sorted.length} 自訂${state.hidePresetHolidays ? "" : " · 預載假期已標記"}`
          : (state.hidePresetHolidays ? "0 日" : "預載假期已標記");
      }
      if (!ul) return;
      ul.innerHTML = "";
      if (!sorted.length) {
        ul.innerHTML = "<li style=\"color:var(--muted);font-size:13px;border:0\">未設定店休日</li>";
        return;
      }
      sorted.forEach((h) => {
        const li = document.createElement("li");
        const d = new Date(h.date + "T12:00:00");
        const dow = DAY_NAMES[d.getDay()];
        li.innerHTML = `<span><strong>${h.date}</strong>（${dow}）${h.note ? " · " + h.note : ""}</span>`;
        const del = document.createElement("button");
        del.type = "button";
        del.className = "secondary";
        del.textContent = "移除";
        del.addEventListener("click", () => {
          state.shopHolidays = state.shopHolidays.filter((x) => x.date !== h.date);
          saveState(state);
          renderHolidayList();
          renderHolidayAlerts();
          renderWeekProgress();
          renderMonthSchedule();
        });
        li.appendChild(del);
        ul.appendChild(li);
      });
    }

    function renderHolidayAlerts() {
      const box = document.getElementById("holiday-alerts");
      if (!box) return;
      box.innerHTML = "";
      const mon = getMondayDate();
      const shoot = isShootWeek();
      const inWeek = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        if (isPublicHoliday(key)) inWeek.push({ key, dow: d.getDay() });
      }
      inWeek.forEach(({ key, dow }) => {
        const div = document.createElement("div");
        div.className = "holiday-alert";
        const tip = HOLIDAY_TIPS[dow] || "店內休息";
        div.innerHTML = `<strong>本週 ${formatShortDate(new Date(key + "T12:00:00"))}（${DAY_NAMES[dow]}）${getHolidayNote(key)}</strong><br>${tip} · DM 由你回覆`;
        if (dow === 2 && shoot) div.innerHTML += "<br>⚠ 本週係拍攝週 — 記得改期";
        box.appendChild(div);
      });
    }

    function renderWeekDayStrip() {
      const strip = document.getElementById("week-day-strip");
      if (!strip) return;
      strip.innerHTML = "";
      WEEK_DAY_ORDER.forEach((dayDow) => {
        const day = getDayConfig(dayDow);
        if (!day) return;
        const item = document.createElement("div");
        item.className = "week-day-strip-item";
        item.dataset.dow = String(day.day);
        item.innerHTML = `
          <div class="progress-track progress-track-day" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="星期${day.label}">
            <div style="height:0%"></div>
          </div>
          <span class="week-day-strip-label">${day.label}</span>
          <span class="week-day-strip-pct">0%</span>
        `;
        strip.appendChild(item);
      });
    }

    function setBarWidth(id, pct) {
      const el = document.getElementById(id);
      if (el) el.style.width = pct + "%";
    }

    function setProgressbar(trackEl, pct) {
      if (!trackEl) return;
      trackEl.setAttribute("aria-valuenow", String(pct));
    }

    function updateWeekProgressStats() {
      const phase = state.phase === "1" ? "1" : "2";
      const shoot = isShootWeek();
      const whoFilter = state.salonView ? "salon" : null;
      const tasks = collectVisibleTasks(phase, shoot, whoFilter);
      const checks = state.weekProgress?.checks || {};
      let done = 0;
      let youDone = 0;
      let youTotal = 0;
      let salonDone = 0;
      let salonTotal = 0;
      tasks.forEach((t) => {
        const checked = !!checks[t.id];
        if (checked) done += 1;
        if (t.who === "you") {
          youTotal += 1;
          if (checked) youDone += 1;
        } else {
          salonTotal += 1;
          if (checked) salonDone += 1;
        }
      });
      const total = tasks.length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const youPct = youTotal ? Math.round((youDone / youTotal) * 100) : 0;
      const salonPct = salonTotal ? Math.round((salonDone / salonTotal) * 100) : 0;

      setBarWidth("wp-bar-all", pct);
      setBarWidth("wp-bar-you", youPct);
      setBarWidth("wp-bar-salon", salonPct);
      setBarWidth("wp-bar-week-mini", pct);

      const pctEl = document.getElementById("wp-pct-all");
      const pctLabel = document.getElementById("wp-pct-all-label");
      if (pctEl) pctEl.textContent = pct + "%";
      if (pctLabel) pctLabel.textContent = `${pct}% · ${done}/${total} 項`;
      setProgressbar(document.getElementById("wp-track-all"), pct);

      const youEl = document.getElementById("wp-you-stat");
      const salonEl = document.getElementById("wp-salon-stat");
      const youPctEl = document.getElementById("wp-you-pct");
      const salonPctEl = document.getElementById("wp-salon-pct");
      if (youEl) youEl.textContent = `${youDone}/${youTotal}`;
      if (salonEl) salonEl.textContent = `${salonDone}/${salonTotal}`;
      if (youPctEl) youPctEl.textContent = youPct + "%";
      if (salonPctEl) salonPctEl.textContent = salonPct + "%";

      const doneEl = document.getElementById("wp-done-stat");
      if (doneEl) {
        doneEl.textContent = done === total && total > 0
          ? "本週工序完成 ✓"
          : `尚餘 ${total - done} 項`;
      }
      const daysPctEl = document.getElementById("week-days-pct");
      if (daysPctEl) daysPctEl.textContent = total ? `${done}/${total}` : "0/0";

      const dow = new Date().getDay();
      let todayPct = 0;

      WEEK_DAY_ORDER.forEach((dayDow) => {
        const day = getDayConfig(dayDow);
        if (!day?.groups) return;
        const { tasks: dayTasks } = getTasksForDay(day, phase, shoot);
        const filteredDayTasks = whoFilter
          ? dayTasks.filter((t) => t.who === whoFilter)
          : dayTasks;
        const dayDone = filteredDayTasks.filter((t) => checks[t.id]).length;
        const dayTotal = filteredDayTasks.length;
        const dayPct = dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0;
        if (day.day === dow) todayPct = dayPct;

        const stripItem = document.querySelector(`.week-day-strip-item[data-dow="${day.day}"]`);
        if (stripItem) {
          const stripBar = stripItem.querySelector(".progress-track-day > div");
          const stripPct = stripItem.querySelector(".week-day-strip-pct");
          const stripTrack = stripItem.querySelector(".progress-track-day");
          if (stripBar) stripBar.style.height = dayPct + "%";
          if (stripPct) stripPct.textContent = dayTotal ? dayPct + "%" : "—";
          if (stripTrack) setProgressbar(stripTrack, dayPct);
          stripItem.classList.toggle("is-today", day.day === dow);
          stripItem.classList.toggle("is-done", dayTotal > 0 && dayDone === dayTotal);
        }

        const card = document.querySelector(`.week-day-card[data-dow="${day.day}"]`);
        if (!card) return;
        const dayBar = card.querySelector(".week-day-progress-row .progress-track > div");
        const dayPctEl = card.querySelector(".week-day-progress-pct");
        const dayCountEl = card.querySelector(".week-day-pct");
        const dayTrack = card.querySelector(".week-day-progress-row .progress-track");
        if (dayBar) dayBar.style.width = dayPct + "%";
        if (dayPctEl) dayPctEl.textContent = dayPct + "%";
        if (dayCountEl) dayCountEl.textContent = dayTotal ? `${dayDone}/${dayTotal}` : "—";
        if (dayTrack) setProgressbar(dayTrack, dayPct);
        card.classList.toggle("is-done", dayTotal > 0 && dayDone === dayTotal);
        card.classList.toggle("is-today", day.day === dow);
      });

      setBarWidth("wp-bar-today", todayPct);
      const todayPctEl = document.getElementById("wp-today-pct");
      const weekMiniEl = document.getElementById("wp-week-pct-mini");
      if (todayPctEl) todayPctEl.textContent = todayPct + "%";
      if (weekMiniEl) weekMiniEl.textContent = pct + "%";
      const todayTrack = document.querySelector("#wp-bar-today")?.parentElement;
      if (todayTrack) setProgressbar(todayTrack, todayPct);
      const weekMiniTrack = document.getElementById("wp-bar-week-mini")?.parentElement;
      if (weekMiniTrack) setProgressbar(weekMiniTrack, pct);
    }

    function renderWeekProgress() {
      const grid = document.getElementById("week-progress-grid");
      const rangeEl = document.getElementById("week-progress-range");
      if (!grid) return;
      ensureWeekProgress();
      const phase = state.phase === "1" ? "1" : "2";
      const shoot = isShootWeek();
      const mon = getMondayDate();
      if (rangeEl) {
        const sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        const holCount = (state.shopHolidays || []).filter((h) => {
          const d = new Date(h.date + "T12:00:00");
          const wkStart = new Date(mon);
          const wkEnd = new Date(sun);
          wkEnd.setHours(23, 59, 59, 999);
          return d >= wkStart && d <= wkEnd;
        }).length;
        let range = `${formatShortDate(mon)}（一）– ${formatShortDate(sun)}（日） · ${phase === "1" ? "Phase 1" : "Phase 2"} · ${shoot ? "拍攝週" : "後製週"}`;
        if (state.salonView) {
          range = `${formatShortDate(mon)}（一）– ${formatShortDate(sun)}（日） · 店內模式 · ${shoot ? "拍攝週" : "後製週"}`;
        }
        if (holCount) range += ` · ${holCount} 日店休`;
        rangeEl.textContent = range;
      }
      renderWeekDayStrip();
      renderHolidayAlerts();
      grid.innerHTML = "";
      const checks = state.weekProgress.checks;
      const todayDow = new Date().getDay();
      const dayOrder = [...WEEK_DAY_ORDER].sort((a, b) => {
        const da = getDayConfig(a);
        const db = getDayConfig(b);
        if (da?.day === todayDow) return -1;
        if (db?.day === todayDow) return 1;
        return 0;
      });

      dayOrder.forEach((dayDow) => {
        const day = getDayConfig(dayDow);
        if (!day) return;
        const { tasks, dateKey, closed, pubHol } = getTasksForDay(day, phase, shoot);
        const card = document.createElement("article");
        card.className = "week-day-card";
        card.dataset.dow = String(day.day);
        if (closed) card.classList.add("is-shop-closed");

        const dayDate = new Date(dateKey + "T12:00:00");
        const head = document.createElement("div");
        head.className = "week-day-head";
        let badge = "";
        if (pubHol) badge = `<span class="holiday-badge">${getHolidayNote(dateKey)}</span>`;
        else if (day.shopClosed) badge = `<span class="holiday-badge">店休</span>`;
        head.innerHTML = `<strong>星期${day.label}</strong>${badge}<span class="week-day-date">${formatShortDate(dayDate)}</span><span class="week-day-pct">0/0</span>`;

        const barRow = document.createElement("div");
        barRow.className = "week-day-progress-row";
        barRow.innerHTML = `
          <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="星期${day.label}進度">
            <div style="width:0%"></div>
          </div>
          <span class="week-day-progress-pct">0%</span>
        `;
        card.append(head, barRow);

        if (pubHol && HOLIDAY_TIPS[day.day]) {
          const tip = document.createElement("p");
          tip.style.cssText = "margin:0 0 10px;font-size:12px;color:var(--muted);line-height:1.5";
          tip.textContent = "↳ " + HOLIDAY_TIPS[day.day] + " · DM 你覆";
          card.appendChild(tip);
        } else if (day.note) {
          const tip = document.createElement("p");
          tip.style.cssText = "margin:0 0 10px;font-size:12px;color:var(--muted);line-height:1.5";
          tip.textContent = day.note;
          card.appendChild(tip);
        }

        const byWho = { you: [], salon: [] };
        tasks.forEach((t) => byWho[t.who].push(t));
        ["you", "salon"].forEach((who) => {
          if (!byWho[who].length) return;
          const whoLabel = document.createElement("div");
          whoLabel.className = `week-task-who ${who}`;
          whoLabel.textContent = who === "you" ? "你" : "店內";
          card.appendChild(whoLabel);
          const ul = document.createElement("ul");
          ul.className = "checklist";
          byWho[who].forEach((item) => {
            const li = document.createElement("li");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.id = item.id;
            cb.checked = !!checks[item.id];
            const label = document.createElement("label");
            label.htmlFor = item.id;
            label.textContent = item.label;
            if (item.id === "wp-d5-y3") {
              const link = document.createElement("a");
              link.href = "beauty-salon-marketing-tracker.html#weekly-review";
              link.target = "_blank";
              link.rel = "noopener";
              link.className = "tracker-inline-link";
              link.textContent = "開 Tracker 週報";
              link.addEventListener("click", () => syncSharedContext());
              label.appendChild(link);
            }
            cb.addEventListener("change", () => {
              ensureWeekProgress();
              state.weekProgress.checks[item.id] = cb.checked;
              saveState(state);
              updateWeekProgressStats();
            });
            li.append(cb, label);
            ul.appendChild(li);
          });
          card.appendChild(ul);
        });
        grid.appendChild(card);
      });

      updateWeekProgressStats();
      renderShootMultiplex();
    }

    function renderBacklog() {
      const ul = document.getElementById("theme-backlog");
      const badge = document.getElementById("backlog-count-badge");
      const items = state.themeBacklog || [];
      const active = items.filter((i) => i.status !== "used").length;
      if (badge) badge.textContent = `${active} 條`;
      if (!ul) return;
      ul.innerHTML = "";
      state.themeBacklog.forEach((item) => {
        const li = document.createElement("li");
        if (item.status === "used") li.classList.add("used");
        const left = document.createElement("div");
        left.innerHTML = `<span class="tag ${item.status === "used" ? "used" : ""}">${item.source}</span>${item.status === "used" ? "已用 · " : ""}${item.text}<div class="backlog-meta">${item.angle || ""} ${item.usedAt ? "· " + item.usedAt : ""}</div>`;
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.flexDirection = "column";
        actions.style.gap = "4px";
        if (item.status !== "used") {
          const pick = document.createElement("button");
          pick.type = "button";
          pick.textContent = "本週";
          pick.className = "secondary";
          pick.style.fontSize = "12px";
          pick.addEventListener("click", () => {
            state.weekTheme.title = item.text;
            state.weekTheme.why = `來自 backlog（${item.source}）`;
            if (item.angles?.length) state.weekTheme.weekAngles = [...item.angles];
            document.getElementById("week-theme-title").value = state.weekTheme.title;
            document.getElementById("week-theme-why").value = state.weekTheme.why;
            saveState(state);
            recordThemeHistory(state.weekTheme.title, state.weekTheme.weekAngles);
            syncSharedContext();
            renderWeekAnglesGrid();
            syncThemeBar();
            updateToday();
            renderThemeRepeatWarning();
          });
          actions.appendChild(pick);
        }
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "刪";
        del.className = "secondary";
        del.style.fontSize = "12px";
        del.addEventListener("click", () => {
          state.themeBacklog = state.themeBacklog.filter((x) => x.id !== item.id);
          saveState(state);
          renderBacklog();
        });
        actions.appendChild(del);
        li.append(left, actions);
        ul.appendChild(li);
      });
    }

    function syncWeekThemeFromInputs() {
      const titleEl = document.getElementById("week-theme-title");
      const monthEl = document.getElementById("month-theme-title");
      state.weekTheme = {
        title: (titleEl?.value || monthEl?.value || "").trim(),
        kw: document.getElementById("week-theme-kw")?.value.trim() || "",
        why: document.getElementById("week-theme-why")?.value.trim() || "",
        weekAngles: state.weekTheme?.weekAngles || []
      };
      saveState(state);
      recordThemeHistory(state.weekTheme.title, state.weekTheme.weekAngles);
      syncSharedContext();
      syncThemeBar();
      renderWeekAnglesGrid();
      renderStudio();
      updateToday();
      renderMonthCalendar();
      renderThemeRepeatWarning();
    }

    let toastTimer = null;
    function showPhaseToast(msg) {
      const el = document.getElementById("phase-toast");
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
    }

    function setPhase(phase, options = {}) {
      state.phase = phase === "1" ? "1" : "2";
      saveState(state);
      applyPhaseUI(options.showFeedback !== false);
      if (options.scroll) scrollToPhaseSection(state.phase);
    }

    function applyPhaseUI(showFeedback) {
      const p = state.phase === "1" ? "1" : "2";
      document.querySelectorAll(".phase-btn, .phase-toggle button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.phase === p);
      });
      document.querySelectorAll(".phase-1-only").forEach((el) => {
        el.hidden = p !== "1";
      });
      document.querySelectorAll(".phase-2-only").forEach((el) => {
        el.hidden = p !== "2";
      });
      const themesSec = document.getElementById("themes");
      if (themesSec) themesSec.hidden = p !== "2";
      const matrixSec = document.getElementById("content-matrix");
      if (matrixSec) matrixSec.hidden = p !== "2";
      updateToday();
      renderWeekProgress();
      renderMonthSchedule();
      renderDailyPrep();
      renderWeekAnglesGrid();
      if (p === "2") renderContentMatrix();
      renderMarketingHub();
      updatePhase1CompleteBanner();
      if (showFeedback) {
        showPhaseToast(p === "1" ? "已切換：Phase 1（抄內容日程）" : "已切換：Phase 2（主題發掘）");
      }
    }

    function applySalonView(showFeedback) {
      const on = !!state.salonView;
      document.body.classList.toggle("salon-view", on);
      document.querySelectorAll(".salon-view-toggle").forEach((btn) => {
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = on ? "Marketer 模式" : "店內模式";
      });
      const salonLabel = document.querySelector(".salon-nav-label");
      if (salonLabel) salonLabel.hidden = !on;
      if (on) {
        document.getElementById("dm")?.setAttribute("open", "");
        document.getElementById("contacts")?.setAttribute("open", "");
        document.getElementById("templates")?.setAttribute("open", "");
      }
      updateToday();
      renderWeekProgress();
      if (showFeedback) {
        showPhaseToast(on ? "已切換：店內模式" : "已切換：Marketer 模式");
      }
    }

    function setSalonView(on, options = {}) {
      const showFeedback = options.showFeedback !== false;
      const updateHash = options.updateHash !== false;
      state.salonView = !!on;
      saveState(state);
      applySalonView(showFeedback);
      if (updateHash) {
        if (on && location.hash !== "#salon-view") {
          history.replaceState(null, "", "#salon-view");
        } else if (!on && location.hash === "#salon-view") {
          history.replaceState(null, "", location.pathname + location.search);
        }
      }
    }

    function syncSalonViewFromHash() {
      if (location.hash === "#salon-view") {
        state.salonView = true;
        saveState(state);
      }
    }

    // Phase 切換：事件委派，確保按鈕一定有效
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".phase-btn");
      if (btn?.dataset?.phase) {
        setPhase(btn.dataset.phase, { showFeedback: true, scroll: true });
      }
    });

    function bindOptional(id, event, handler) {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    }

    function applyPhase0ArchiveUI() {
      const done = !!state.phase0Archived;
      const sec = document.getElementById("phase0");
      sec.classList.toggle("phase0-done", done);
      document.getElementById("phase0-body").hidden = done;
      document.getElementById("phase0-collapsed").hidden = !done;
      document.getElementById("archive-phase0").hidden = done;
      document.getElementById("phase0-actions").hidden = done;
      document.getElementById("phase0-complete-msg").hidden = !done;
      const showBtn = document.getElementById("show-phase0");
      if (showBtn) showBtn.hidden = !done;
    }

    function scrollToToday() {
      document.getElementById("today").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function scrollToPhaseSection(phase) {
      const target = phase === "1"
        ? document.getElementById("phase-guide")
        : document.getElementById("themes");
      if (target && !target.hidden) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        scrollToToday();
      }
    }

    function updateToday() {
      const now = new Date();
      const dow = now.getDay();
      const shoot = isShootWeek(now);
      const theme = state.weekTheme?.title || "";

      if (state.salonView) {
        const salonPanels = {
          1: "Confirm 本週主題／療程講法／空檔；審批 deadline",
          2: shoot ? "老闆出鏡、場地、同意書" : "交 3–5 條店內素材",
          3: "店內配合後製素材（如有需要）",
          4: "回 DM；確認週末空檔",
          5: "18:00 前交週報（5 數 + FAQ）",
          6: "即場素材；跟進週末預約",
          0: "店休 — DM 由 marketing 覆"
        };
        const todayKey = getDateKeyForWeekday(dow);
        const todayHol = isPublicHoliday(todayKey);
        let sub = salonPanels[dow] || "";
        if (todayHol) {
          sub = `公眾假期（${getHolidayNote(todayKey)}）— 店內休息 · DM 由 marketing 覆`;
        }
        document.getElementById("today-title").textContent =
          dow === 0 ? "星期日 — 店休" : `星期${DAY_NAMES[dow]} — 店內工序`;
        document.getElementById("today-sub").textContent = sub;
        document.getElementById("shoot-pill").textContent = shoot ? "本週：拍攝週" : "本週：後製週";
        document.getElementById("shoot-pill").className = shoot ? "pill warn" : "pill blue";
        if (todayHol) {
          document.getElementById("shoot-pill").textContent = "今日：店休";
          document.getElementById("shoot-pill").className = "pill warn";
        }
        if (state.weekProgress) updateWeekProgressStats();
        return;
      }

      document.getElementById("today-title").textContent =
        dow === 0 ? "星期日 — Tracker / 數據 / DM" : `星期${DAY_NAMES[dow]} — 今日工序`;

      const todayKey = getDateKeyForWeekday(dow);
      const todayHol = isPublicHoliday(todayKey);

      const panels = {
        1: state.phase === "1"
          ? "M1：復盤 → 抄內容日程 → Brief（M2 開始用主題 backlog）"
          : "復盤 → 主題發掘 → 揀本週題 → Prompt 1–4 → Brief",
        2: shoot ? "拍攝半日（3 Reel + 素材）" : "剪片 / 補 B-roll / 收店內素材",
        3: "後製日 3–4hr：剪片 + Carousel + 排程；今晚出核心 Reel",
        4: "出 Carousel + Story；DM 30–45min",
        5: "Reel#2 + 收店內 5 個數 + tracker 週報",
        6: "Reel#3 + 週末 Story CTA；跟進預約",
        0: "Tracker + 數據分析 + backlog；DM 全覆（你負責）"
      };
      let sub = panels[dow] || "";
      if (todayHol) {
        const tip = HOLIDAY_TIPS[dow] || "店內休息";
        sub = `公眾假期（${getHolidayNote(todayKey)}）— ${tip} · DM 你覆`;
      }
      if (theme && dow === 1 && !todayHol) {
        const ang = formatWeekAngles(state.weekTheme?.weekAngles || [], 2);
        sub += `｜痛點：${truncate(theme, 32)}${ang ? "（" + ang + "）" : ""}`;
      }
      if (state.phase === "1" && state.m1Week && dow === 1 && !todayHol) {
        sub += `｜M1 W${state.m1Week}`;
      }
      if (!todayHol && CTA_BY_DOW[dow]) {
        sub += `｜今日 CTA：${CTA_BY_DOW[dow].cta}`;
      }
      document.getElementById("today-sub").textContent = sub;
      document.getElementById("phase-pill").textContent = state.phase === "1" ? "Phase 1 引導" : "Phase 2 常態";
      document.getElementById("week-pill").textContent = theme
        ? truncate(theme) + (state.weekTheme?.weekAngles?.length ? " · " + formatWeekAngles(state.weekTheme.weekAngles, 1) : "")
        : "未設定痛點";
      document.getElementById("week-pill").title = theme
        ? theme + (state.weekTheme?.weekAngles?.length ? "\n角度：" + state.weekTheme.weekAngles.join("、") : "")
        : "";
      document.getElementById("shoot-pill").textContent = shoot ? "本週：拍攝週" : "本週：後製週";
      document.getElementById("shoot-pill").className = shoot ? "pill warn" : "pill blue";
      if (todayHol) {
        document.getElementById("shoot-pill").textContent = "今日：店休";
        document.getElementById("shoot-pill").className = "pill warn";
      }

      document.querySelectorAll(".day-tabs button").forEach((btn) => {
        const d = Number(btn.dataset.day);
        btn.classList.toggle("active", d === dow);
        btn.classList.toggle("today-ring", d === dow);
      });
      document.querySelectorAll(".day-panel").forEach((p) => {
        p.classList.toggle("active", Number(p.dataset.dayPanel) === dow);
      });
      if (state.weekProgress) updateWeekProgressStats();
    }

    function updateToolsPrepStats() {
      const panel = document.getElementById("tools-prep-panel");
      const pctEl = document.getElementById("tools-prep-pct");
      if (!panel || !pctEl) return;
      const boxes = panel.querySelectorAll('input[type="checkbox"]');
      const done = [...boxes].filter((cb) => cb.checked).length;
      const total = boxes.length;
      pctEl.textContent = total ? `${done}/${total}` : "0/0";
      if (total && done === total) panel.removeAttribute("open");
    }

    // Checklists
    document.querySelectorAll(".checklist[data-store]").forEach((list) => {
      const key = list.dataset.store;
      if (!state.checks) state.checks = {};
      if (!state.checks[key]) state.checks[key] = {};
      list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        cb.checked = !!state.checks[key][cb.id];
        cb.addEventListener("change", () => {
          state.checks[key][cb.id] = cb.checked;
          saveState(state);
          if (key === "tools-prep") updateToolsPrepStats();
          if (key === "daily-you" || key === "daily-salon") updateDailyDockPct();
          if (key === "phase1-week") updatePhase1CompleteBanner();
        });
      });
    });
    updateToolsPrepStats();

    // Contacts
    document.querySelectorAll("[data-contact]").forEach((input) => {
      const k = input.dataset.contact;
      input.value = state.contacts[k] || "";
      input.addEventListener("input", () => {
        state.contacts[k] = input.value;
        saveState(state);
      });
    });

    bindOptional("shoot-anchor", "change", (e) => {
      state.shootAnchor = e.target.value;
      saveState(state);
      updateToday();
      renderWeekProgress();
      renderMonthSchedule();
    });
    const shootEl = document.getElementById("shoot-anchor");
    if (shootEl) shootEl.value = state.shootAnchor;

    bindOptional("hide-preset-holidays", "change", (e) => {
      state.hidePresetHolidays = !!e.target.checked;
      saveState(state);
      renderHolidayList();
      renderHolidayAlerts();
      renderWeekProgress();
      renderMonthSchedule();
      updateToday();
    });
    const hidePresetEl = document.getElementById("hide-preset-holidays");
    if (hidePresetEl) hidePresetEl.checked = !!state.hidePresetHolidays;

    bindWorkflowBackupControls("export-workflow-json", "import-workflow-json");
    bindWorkflowBackupControls("export-workflow-json-ref", "import-workflow-json-ref");

    bindOptional("phase1-switch-btn", "click", () => {
      state.phase1CompleteBannerDismissed = true;
      saveState(state);
      setPhase("2", { showFeedback: true, scroll: true });
      updatePhase1CompleteBanner();
    });
    bindOptional("phase1-dismiss-btn", "click", () => {
      state.phase1CompleteBannerDismissed = true;
      saveState(state);
      updatePhase1CompleteBanner();
    });

    const weekFields = ["week-theme-title", "week-theme-kw", "week-theme-why"];
    weekFields.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === "week-theme-title") el.value = state.weekTheme.title || "";
      if (id === "week-theme-kw") el.value = state.weekTheme.kw || "";
      if (id === "week-theme-why") el.value = state.weekTheme.why || "";
      el.addEventListener("input", syncWeekThemeFromInputs);
      el.addEventListener("change", syncWeekThemeFromInputs);
    });

    bindOptional("month-theme-title", "input", syncThemeFromBar);
    bindOptional("month-theme-note", "change", () => {
      const note = document.getElementById("month-theme-note")?.value.trim();
      if (note) state.weekTheme.why = note;
      saveState(state);
      syncThemeBar();
    });
    bindOptional("m1-week-num", "change", (e) => {
      state.m1Week = e.target.value;
      saveState(state);
      syncThemeBar();
      updateToday();
    });

    bindOptional("month-prev", "click", () => {
      viewMonthIdx -= 1;
      if (viewMonthIdx < 0) { viewMonthIdx = 11; viewMonthYear -= 1; }
      renderMonthCalendar();
    });
    bindOptional("month-next", "click", () => {
      viewMonthIdx += 1;
      if (viewMonthIdx > 11) { viewMonthIdx = 0; viewMonthYear += 1; }
      renderMonthCalendar();
    });
    bindOptional("month-today", "click", () => {
      const n = new Date();
      viewMonthYear = n.getFullYear();
      viewMonthIdx = n.getMonth();
      renderMonthCalendar();
    });

    bindOptional("add-theme", "click", () => {
      const text = document.getElementById("new-theme-text")?.value.trim();
      if (!text) return;
      state.themeBacklog.unshift({
        id: "t" + Date.now(),
        text,
        source: document.getElementById("new-theme-source")?.value || "自己觀察",
        status: "idea",
        angle: "",
        usedAt: ""
      });
      const newInput = document.getElementById("new-theme-text");
      if (newInput) newInput.value = "";
      saveState(state);
      renderBacklog();
    });

    bindOptional("archive-phase0", "click", () => {
      state.phase0Archived = true;
      saveState(state);
      applyPhase0ArchiveUI();
      setPhase(state.phase || "2", { showFeedback: false, scroll: false });
      scrollToToday();
      showPhaseToast("Phase 0 完成！請用頂部揀 Phase 1 或 Phase 2");
    });
    bindOptional("show-phase0", "click", () => {
      state.phase0Archived = false;
      saveState(state);
      applyPhase0ArchiveUI();
    });
    bindOptional("salon-view-toggle", "click", () => setSalonView(!state.salonView));
    bindOptional("salon-view-toggle-mobile", "click", () => setSalonView(!state.salonView));

    bindOptional("goto-today", "click", scrollToToday);
    bindOptional("pick-phase1", "click", () => setPhase("1", { scroll: true }));
    bindOptional("pick-phase2", "click", () => setPhase("2", { scroll: true }));

    document.querySelectorAll("[data-phase-nav]").forEach((link) => {
      link.addEventListener("click", (e) => {
        const p = link.dataset.phaseNav;
        if (p === "1" || p === "2") {
          setPhase(p, { showFeedback: true, scroll: false });
        }
      });
    });

    // Day tabs
    document.querySelectorAll(".day-tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = Number(btn.dataset.day);
        document.querySelectorAll(".day-tabs button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".day-panel").forEach((p) => {
          p.classList.toggle("active", Number(p.dataset.dayPanel) === d);
        });
      });
    });

    // Copy buttons
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = document.getElementById(btn.dataset.copy).textContent;
        try {
          await navigator.clipboard.writeText(text);
          const old = btn.textContent;
          btn.textContent = "已複製";
          setTimeout(() => { btn.textContent = old; }, 1500);
        } catch {
          alert("請手動複製文字框內容");
        }
      });
    });

    bindOptional("reset-phase0", "click", () => {
      ["phase0-account", "phase0-coop"].forEach((key) => {
        state.checks[key] = {};
      });
      saveState(state);
      location.reload();
    });
    bindOptional("reset-daily", "click", () => {
      state.checks["daily-you"] = {};
      state.checks["daily-salon"] = {};
      saveState(state);
      document.querySelectorAll('.checklist[data-store="daily-you"] input, .checklist[data-store="daily-salon"] input').forEach((cb) => {
        cb.checked = false;
      });
      updateDailyDockPct();
      showPhaseToast("已重設今日勾選");
    });
    bindOptional("reset-week-progress", "click", () => {
      ensureWeekProgress();
      state.weekProgress.checks = {};
      saveState(state);
      renderWeekProgress();
      showPhaseToast("已重設本週進度");
    });

    function addShopHoliday(date, note) {
      if (!date) return;
      if (!state.shopHolidays) state.shopHolidays = [];
      if (!state.shopHolidays.some((h) => h.date === date)) {
        state.shopHolidays.push({ date, note: note || "" });
        state.shopHolidays.sort((a, b) => a.date.localeCompare(b.date));
        saveState(state);
      }
      renderHolidayList();
      renderHolidayAlerts();
      renderWeekProgress();
      renderMonthSchedule();
      showPhaseToast("已加入店休日：" + date);
    }

    bindOptional("add-holiday", "click", () => {
      const date = document.getElementById("holiday-date")?.value;
      const note = document.getElementById("holiday-note")?.value.trim();
      if (!date) return;
      addShopHoliday(date, note);
      document.getElementById("holiday-note").value = "";
    });

    bindOptional("matrix-apply-top", "click", () => {
      const top = getSortedQuestions().find((x) => x.hasText);
      if (top) applyMatrixQuestionToWeek(top.q);
      else showPhaseToast("請先填至少一條問題");
    });
    bindOptional("matrix-expand-all", "click", () => {
      ensureContentMatrix();
      state.contentMatrix.questions.forEach((q) => { q.drawerOpen = true; });
      saveState(state);
      renderContentMatrix();
    });
    bindOptional("matrix-collapse-all", "click", () => {
      ensureContentMatrix();
      state.matrixActiveQ = -1;
      state.contentMatrix.questions.forEach((q) => { q.drawerOpen = false; });
      saveState(state);
      renderContentMatrix();
    });
    document.querySelectorAll("[data-matrix-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.matrixFilter = btn.dataset.matrixFilter;
        saveState(state);
        renderContentMatrix();
      });
    });

    function updateDailyDockPct() {
      const pctEl = document.getElementById("daily-dock-pct");
      if (!pctEl) return;
      let done = 0;
      let total = 0;
      ["daily-you", "daily-salon"].forEach((key) => {
        document.querySelectorAll(`.checklist[data-store="${key}"] input[type=checkbox]`).forEach((cb) => {
          total += 1;
          if (cb.checked) done += 1;
        });
      });
      pctEl.textContent = total ? `${done}/${total}` : "0/8";
    }

    function setDailyDockOpen(open) {
      state.dailyDockOpen = !!open;
      saveState(state);
      const panel = document.getElementById("daily-dock-panel");
      const toggle = document.getElementById("daily-dock-toggle");
      const backdrop = document.getElementById("daily-dock-backdrop");
      if (panel) {
        panel.hidden = !state.dailyDockOpen;
        panel.setAttribute("aria-hidden", String(!state.dailyDockOpen));
      }
      if (toggle) toggle.setAttribute("aria-expanded", String(state.dailyDockOpen));
      if (backdrop) {
        backdrop.classList.toggle("visible", state.dailyDockOpen);
        backdrop.hidden = !state.dailyDockOpen;
      }
    }

    function toggleDailyDock(forceOpen) {
      const next = forceOpen !== undefined ? forceOpen : !state.dailyDockOpen;
      setDailyDockOpen(next);
    }

    bindOptional("daily-dock-toggle", "click", (e) => {
      e.stopPropagation();
      toggleDailyDock();
    });
    bindOptional("daily-dock-close", "click", () => toggleDailyDock(false));
    bindOptional("daily-dock-backdrop", "click", () => toggleDailyDock(false));
    bindOptional("nav-daily-dock", "click", (e) => {
      e.preventDefault();
      toggleDailyDock(true);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.dailyDockOpen) toggleDailyDock(false);
    });

    // Sidebar mobile + active link
    const sidebar = document.getElementById("sidebar");
    bindOptional("menu-toggle", "click", () => {
      if (!sidebar) return;
      const open = sidebar.classList.toggle("open");
      document.getElementById("menu-toggle").setAttribute("aria-expanded", open);
    });
    function openRefFromHash() {
      const id = (location.hash || "").slice(1);
      if (!id) return;
      if (id === "salon-view") {
        if (!state.salonView) setSalonView(true, { showFeedback: false, updateHash: false });
        return;
      }
      const el = document.getElementById(id);
      if (el?.tagName === "DETAILS") el.open = true;
      if (id === "weekly") document.getElementById("weekly-master-drawer")?.setAttribute("open", "");
      if (id === "weekly-report-template") {
        document.getElementById("templates")?.setAttribute("open", "");
        document.getElementById("weekly-report-template")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    document.querySelectorAll("nav a").forEach((a) => {
      a.addEventListener("click", () => {
        sidebar.classList.remove("open");
        const id = a.getAttribute("href")?.slice(1);
        const el = id && document.getElementById(id);
        if (el?.tagName === "DETAILS") el.open = true;
        if (id === "weekly") document.getElementById("weekly-master-drawer")?.setAttribute("open", "");
      });
    });
    window.addEventListener("hashchange", openRefFromHash);
    const sections = [...document.querySelectorAll("main section, .topbar")];
    const navLinks = [...document.querySelectorAll("nav a")];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === "#" + id);
          });
        }
      });
    }, { rootMargin: "-20% 0px -60% 0px", threshold: 0 });
    sections.forEach((s) => { if (s.id) observer.observe(s); });

    applyPhase0ArchiveUI();
    syncSalonViewFromHash();
    applyPhaseUI(false);
    applySalonView(false);
    renderBacklog();
    renderThemeHistory();
    renderThemeRepeatWarning();
    syncSharedContext();
    renderHolidayList();
    renderMonthSchedule();
    renderWeekAnglesGrid();
    renderContentMatrix();
    renderMarketingHub();
    setDailyDockOpen(!!state.dailyDockOpen);
    updateDailyDockPct();
    updatePhase1CompleteBanner();
    openRefFromHash();

    // PWA service worker (skipped on file:// — no throw)
    (function registerWorkflowServiceWorker() {
      if (!("serviceWorker" in navigator)) return;
      if (location.protocol === "file:") return;
      try {
        navigator.serviceWorker.register("jessi-workflow-sw.js").catch(function () {});
      } catch (_) {}
    })();
