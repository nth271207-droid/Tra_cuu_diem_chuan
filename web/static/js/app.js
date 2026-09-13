/**
 * Frontend logic for Đại Học Benchmark Lookup
 * - Chức năng chính: Tự động phân tích điểm thi THPT và hiển thị các trường có khả năng đậu
 * - Hỗ trợ Dual-Mode: Chạy offline/static 100% trên GitHub Pages hoặc qua FastAPI backend
 */

document.addEventListener("DOMContentLoaded", () => {
    let currentPage = 1;
    let totalPages = 1;
    let debounceTimer = null;
    let viewMode = "grouped"; // "grouped" hoặc "flat"

    // Kiểm tra môi trường Static (GitHub Pages hoặc mở file trực tiếp)
    let isStaticMode = window.location.hostname.endsWith("github.io") || 
                       window.location.protocol === "file:" || 
                       window.location.port === "" && !window.location.hostname.includes("localhost");
    let staticScoresData = null;
    const STATIC_BASE = "./data/static_data";

    // DOM Elements - THPT Guidance Mode
    const inputThptScore = document.getElementById("input-thpt-score");
    const selectSubjectGroup = document.getElementById("select-subject-group");
    const selectChanceLevel = document.getElementById("select-chance-level");
    const filterThptKeyword = document.getElementById("filter-thpt-keyword");
    const filterThptYear = document.getElementById("filter-thpt-year");
    const btnClearThpt = document.getElementById("btn-clear-thpt");
    const quickScoreButtons = document.querySelectorAll(".btn-quick-score");

    const promptEnterScore = document.getElementById("prompt-enter-score");
    const thptSummaryBar = document.getElementById("thpt-summary-bar");
    const thptSummaryText = document.getElementById("thpt-summary-text");
    const schoolsCardsList = document.getElementById("schools-cards-list");
    const schoolsEmptyState = document.getElementById("schools-empty-state");

    const btnExpandAll = document.getElementById("btn-expand-all");
    const btnCollapseAll = document.getElementById("btn-collapse-all");

    // Tab Elements
    const tabBtnSchools = document.getElementById("tab-btn-schools");
    const tabBtnTable = document.getElementById("tab-btn-table");
    const viewSchoolsContainer = document.getElementById("view-schools-container");
    const viewTableContainer = document.getElementById("view-table-container");
    const schoolsActions = document.getElementById("schools-actions");

    // DOM Elements - Raw Table Mode
    const sortBySelect = document.getElementById("sort-by");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnViewGrouped = document.getElementById("btn-view-grouped");
    const btnViewFlat = document.getElementById("btn-view-flat");
    const tableHead = document.getElementById("scores-table-head");
    const tableBody = document.getElementById("scores-table-body");
    const emptyState = document.getElementById("empty-state");
    const resultsCount = document.getElementById("results-count");
    const currentPageDisplay = document.getElementById("current-page-display");
    const totalPagesDisplay = document.getElementById("total-pages-display");
    const paginationControls = document.getElementById("pagination-controls");

    // Stat Elements
    const statUniversities = document.getElementById("stat-universities");
    const statScores = document.getElementById("stat-scores");

    // 1. Initial Data Fetching
    loadStats();
    loadStaticDataIfNeeded();

    // 2. Event Listeners - THPT Score & Filters
    inputThptScore.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleThptAnalysis();
        }, 200);
    });

    [selectSubjectGroup, selectChanceLevel, filterThptYear].forEach(el => {
        el.addEventListener("change", () => {
            handleThptAnalysis();
        });
    });

    filterThptKeyword.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleThptAnalysis();
        }, 250);
    });

    // Nút chọn nhanh điểm mẫu
    quickScoreButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const score = btn.getAttribute("data-score");
            inputThptScore.value = score;
            handleThptAnalysis();
        });
    });

    btnClearThpt.addEventListener("click", () => {
        inputThptScore.value = "";
        selectSubjectGroup.value = "";
        selectChanceLevel.value = "all";
        filterThptKeyword.value = "";
        filterThptYear.value = "";
        handleThptAnalysis();
    });

    // Mở rộng / Thu gọn tất cả trường
    btnExpandAll.addEventListener("click", () => {
        document.querySelectorAll(".school-majors-body").forEach(el => el.classList.remove("hidden"));
        document.querySelectorAll(".school-chevron").forEach(el => el.classList.add("rotate-180"));
    });

    btnCollapseAll.addEventListener("click", () => {
        document.querySelectorAll(".school-majors-body").forEach(el => el.classList.add("hidden"));
        document.querySelectorAll(".school-chevron").forEach(el => el.classList.remove("rotate-180"));
    });

    // Tab Switcher
    tabBtnSchools.addEventListener("click", () => {
        tabBtnSchools.className = "px-4 py-2 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-xs flex items-center gap-2 transition-all";
        tabBtnTable.className = "px-4 py-2 rounded-xl font-semibold text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2 transition-all";
        viewSchoolsContainer.classList.remove("hidden");
        viewTableContainer.classList.add("hidden");
        schoolsActions.classList.remove("hidden");
    });

    tabBtnTable.addEventListener("click", () => {
        tabBtnTable.className = "px-4 py-2 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-xs flex items-center gap-2 transition-all";
        tabBtnSchools.className = "px-4 py-2 rounded-xl font-semibold text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2 transition-all";
        viewTableContainer.classList.remove("hidden");
        viewSchoolsContainer.classList.add("hidden");
        schoolsActions.classList.add("hidden");
        fetchScores();
    });

    // Table Mode Events
    if (btnViewGrouped && btnViewFlat) {
        btnViewGrouped.addEventListener("click", () => {
            if (viewMode === "grouped") return;
            viewMode = "grouped";
            btnViewGrouped.className = "px-2.5 py-1 rounded-md font-semibold text-xs bg-white text-blue-700 shadow-xs flex items-center gap-1.5 transition-all";
            btnViewFlat.className = "px-2.5 py-1 rounded-md font-medium text-xs text-slate-600 hover:text-slate-900 transition-all";
            updateTableHeaders();
            currentPage = 1;
            fetchScores();
        });

        btnViewFlat.addEventListener("click", () => {
            if (viewMode === "flat") return;
            viewMode = "flat";
            btnViewFlat.className = "px-2.5 py-1 rounded-md font-semibold text-xs bg-white text-blue-700 shadow-xs flex items-center gap-1.5 transition-all";
            btnViewGrouped.className = "px-2.5 py-1 rounded-md font-medium text-xs text-slate-600 hover:text-slate-900 transition-all";
            updateTableHeaders();
            currentPage = 1;
            fetchScores();
        });
    }

    if (sortBySelect) {
        sortBySelect.addEventListener("change", () => {
            currentPage = 1;
            fetchScores();
        });
    }

    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
            exportCSV();
        });
    }

    // =========================================================================
    // 3. LOGIC CHÍNH: TỰ ĐỘNG PHÂN TÍCH ĐIỂM THPT & GOM NHÓM THEO TRƯỜNG
    // =========================================================================

    async function handleThptAnalysis() {
        const val = inputThptScore.value.trim();
        const userScore = parseFloat(val);

        if (isNaN(userScore) || userScore <= 0) {
            promptEnterScore.classList.remove("hidden");
            thptSummaryBar.classList.add("hidden");
            schoolsCardsList.innerHTML = "";
            schoolsEmptyState.classList.add("hidden");
            return;
        }

        promptEnterScore.classList.add("hidden");
        thptSummaryBar.classList.remove("hidden");
        thptSummaryText.textContent = `Đang phân tích cơ hội trúng tuyển cho mức điểm ${userScore.toFixed(2)}...`;

        await loadStaticDataIfNeeded();
        if (!staticScoresData) {
            thptSummaryText.textContent = "Không thể tải dữ liệu điểm chuẩn.";
            return;
        }

        const selectedSubject = selectSubjectGroup.value.trim();
        const chanceLevel = selectChanceLevel.value;
        const targetYear = filterThptYear.value ? parseInt(filterThptYear.value) : null;
        const kw = filterThptKeyword.value.trim();
        const kwNorm = removeVietnameseTones(kw);

        // Gom nhóm các ngành hợp lệ theo từng trường (Map: university_code -> school data)
        const schoolsMap = new Map();
        let totalEligibleMajors = 0;

        staticScoresData.forEach(item => {
            if (targetYear && item.year !== targetYear) return;

            // Kiểm tra từ khóa bổ sung (tên ngành hoặc tên trường)
            if (kwNorm) {
                const mNameNorm = removeVietnameseTones(item.major_name || "");
                const uNameNorm = removeVietnameseTones(item.university_name || "");
                const mCode = (item.major_code || "").toLowerCase();
                const uCode = (item.university_code || "").toLowerCase();
                const kwLower = kw.toLowerCase();

                const matchKw = mNameNorm.includes(kwNorm) ||
                                uNameNorm.includes(kwNorm) ||
                                mCode.includes(kwLower) ||
                                uCode.includes(kwLower);
                if (!matchKw) return;
            }

            // Lọc các phương thức liên quan đến Điểm thi THPT (thang điểm 30)
            (item.methods || []).forEach(m => {
                const mName = m.method || "";
                const isThptMethod = mName.includes("THPT") || 
                                     mName.includes("100") || 
                                     (m.cutoff_score !== null && m.cutoff_score <= 30.5 && m.cutoff_score >= 12.0 &&
                                      !mName.includes("TSA") && !mName.includes("ĐGTD") && !mName.includes("HSA") && !mName.includes("V-ACT") && !mName.includes("quốc tế"));

                if (!isThptMethod) return;

                // Lọc theo tổ hợp môn nếu được chọn
                if (selectedSubject) {
                    if (!m.subject_group || !m.subject_group.includes(selectedSubject)) return;
                }

                const cutoff = m.cutoff_score;
                if (cutoff === null || cutoff === undefined || cutoff <= 0) return;

                const diff = userScore - cutoff; // diff >= 0 nghĩa là điểm của bạn cao hơn hoặc bằng điểm chuẩn

                // Lọc theo mức độ cơ hội
                let isEligible = false;
                let chanceType = ""; // 'safe' | 'good' | 'stretch'
                let chanceLabel = "";

                if (diff >= 1.0) {
                    chanceType = "safe";
                    chanceLabel = `🟢 Đỗ rất an toàn (+${diff.toFixed(2)}đ)`;
                } else if (diff >= 0.0) {
                    chanceType = "good";
                    chanceLabel = `🔵 Cơ hội tốt (+${diff.toFixed(2)}đ)`;
                } else if (diff >= -1.0) {
                    chanceType = "stretch";
                    chanceLabel = `🟡 Thử thách / Sát nút (${diff.toFixed(2)}đ)`;
                }

                if (chanceLevel === "all") {
                    isEligible = diff >= -0.25; // Cho phép sát nút một chút
                } else if (chanceLevel === "safe") {
                    isEligible = diff >= 1.0;
                } else if (chanceLevel === "good") {
                    isEligible = diff >= 0.0;
                } else if (chanceLevel === "stretch") {
                    isEligible = diff >= -1.0 && diff < 0.0;
                }

                if (!isEligible) return;

                // Thêm vào danh sách của trường
                const uniCode = item.university_code;
                if (!schoolsMap.has(uniCode)) {
                    schoolsMap.set(uniCode, {
                        code: uniCode,
                        name: item.university_name || uniCode,
                        majors: []
                    });
                }

                // Tránh trùng lặp cùng ngành cùng năm
                const existingMajors = schoolsMap.get(uniCode).majors;
                const isDupe = existingMajors.some(em => em.major_name === item.major_name && em.year === item.year && em.subject_group === m.subject_group);
                if (!isDupe) {
                    existingMajors.push({
                        major_name: item.major_name,
                        major_code: item.major_code,
                        year: item.year,
                        method: m.method,
                        subject_group: m.subject_group,
                        cutoff_score: cutoff,
                        user_score: userScore,
                        diff: diff,
                        chanceType: chanceType,
                        chanceLabel: chanceLabel,
                        quota: item.quota,
                        notes: m.notes
                    });
                    totalEligibleMajors++;
                }
            });
        });

        // Chuyển sang mảng và sắp xếp các trường theo số lượng ngành có cơ hội nhiều nhất
        const schoolsList = Array.from(schoolsMap.values());
        schoolsList.sort((a, b) => b.majors.length - a.majors.length);

        // Trong từng trường, sắp xếp ngành theo điểm chuẩn từ cao xuống thấp
        schoolsList.forEach(school => {
            school.majors.sort((a, b) => b.cutoff_score - a.cutoff_score);
        });

        // Cập nhật thống kê
        if (schoolsList.length === 0) {
            schoolsEmptyState.classList.remove("hidden");
            schoolsCardsList.innerHTML = "";
            thptSummaryText.textContent = `Không tìm thấy ngành nào phù hợp với mức điểm ${userScore.toFixed(2)}. Thử mở rộng mức cơ hội hoặc chọn Tất cả khối.`;
            return;
        }

        schoolsEmptyState.classList.add("hidden");
        thptSummaryText.innerHTML = `🎉 Tìm thấy <span class="font-extrabold text-blue-700 text-base">${schoolsList.length}</span> trường đại học với <span class="font-extrabold text-emerald-700 text-base">${totalEligibleMajors}</span> ngành bạn có cơ hội trúng tuyển ở mức điểm <span class="font-extrabold text-blue-800">${userScore.toFixed(2)}</span>!`;

        // Render các Card trường đại học
        renderSchoolCards(schoolsList, userScore);
    }

    /**
     * RENDER CÁC THẺ TRƯỜNG ĐẠI HỌC VÀ CÁC NGÀNH CÓ CƠ HỘI ĐỖ
     */
    function renderSchoolCards(schoolsList, userScore) {
        let html = "";

        schoolsList.forEach((school, index) => {
            const majorsCount = school.majors.length;
            const isFirstFew = index < 8; // Tự động mở 8 trường đầu tiên

            let rowsHtml = "";
            school.majors.forEach(m => {
                let badgeClass = "chance-badge-good";
                if (m.chanceType === "safe") badgeClass = "chance-badge-safe";
                else if (m.chanceType === "stretch") badgeClass = "chance-badge-stretch";

                // Subject pills
                let subjHtml = "-";
                if (m.subject_group) {
                    const parts = m.subject_group.split(";").map(s => s.trim()).filter(Boolean);
                    if (parts.length > 3) {
                        subjHtml = `<span class="subject-pill">${parts[0]}</span> <span class="text-[10px] text-slate-400 font-medium">+${parts.length - 1}</span>`;
                    } else {
                        subjHtml = parts.map(p => `<span class="subject-pill">${p}</span>`).join(" ");
                    }
                }

                rowsHtml += `
                <tr class="hover:bg-blue-50/40 transition-colors border-b border-slate-100 last:border-b-0 text-xs">
                    <td class="py-2.5 px-4 font-semibold text-slate-800">
                        <div class="text-sm font-bold text-slate-900">${escapeHtml(m.major_name)}</div>
                        ${m.major_code ? `<span class="text-[11px] font-mono text-slate-400">Mã: ${escapeHtml(m.major_code)}</span>` : ""}
                        ${m.notes ? `<span class="text-[10.5px] text-slate-400 italic block mt-0.5">${escapeHtml(m.notes)}</span>` : ""}
                    </td>
                    <td class="py-2.5 px-3 text-center">${subjHtml}</td>
                    <td class="py-2.5 px-3 text-center">
                        <span class="inline-block font-extrabold text-slate-900 text-sm bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            ${m.cutoff_score}
                        </span>
                        <span class="block text-[10px] text-slate-400 mt-0.5">${m.year}</span>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        <span class="font-bold text-blue-700 text-sm">${userScore.toFixed(2)}</span>
                    </td>
                    <td class="py-2.5 px-4 text-right">
                        <span class="${badgeClass}">${m.chanceLabel}</span>
                    </td>
                </tr>
                `;
            });

            html += `
            <div class="uni-card bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
                <!-- Card Header -->
                <div class="school-card-header px-5 py-4 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/70 hover:bg-blue-50/50 border-b border-slate-100 select-none">
                    <div class="flex items-center space-x-3.5 flex-1 min-w-0">
                        <span class="w-12 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white font-black text-sm flex items-center justify-center tracking-tight shadow-xs">
                            ${escapeHtml(school.code)}
                        </span>
                        <div class="truncate">
                            <h3 class="font-extrabold text-slate-900 text-base truncate leading-snug" title="${escapeHtml(school.name)}">
                                ${escapeHtml(school.name)}
                            </h3>
                            <p class="text-xs text-slate-500 mt-0.5">Mã trường: <b class="text-blue-700 font-bold">${escapeHtml(school.code)}</b></p>
                        </div>
                    </div>

                    <div class="flex items-center space-x-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            🟢 ${majorsCount} ngành có thể đỗ
                        </span>
                        <button class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-transform">
                            <i class="fa-solid fa-chevron-down school-chevron transition-transform ${isFirstFew ? 'rotate-180' : ''}"></i>
                        </button>
                    </div>
                </div>

                <!-- Card Body (Danh sách ngành) -->
                <div class="school-majors-body ${isFirstFew ? '' : 'hidden'} overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="bg-slate-100/50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
                            <tr>
                                <th class="py-2 px-4">Tên Ngành Xét Tuyển</th>
                                <th class="py-2 px-3 text-center w-28">Khối Thi</th>
                                <th class="py-2 px-3 text-center w-24">Điểm Chuẩn</th>
                                <th class="py-2 px-3 text-center w-24">Điểm Của Bạn</th>
                                <th class="py-2 px-4 text-right w-44">Đánh Giá Cơ Hội</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
            `;
        });

        schoolsCardsList.innerHTML = html;

        // Bắt sự kiện bấm vào Header để mở rộng/thu gọn card
        document.querySelectorAll(".school-card-header").forEach(header => {
            header.addEventListener("click", () => {
                const body = header.nextElementSibling;
                const chevron = header.querySelector(".school-chevron");
                const isHidden = body.classList.contains("hidden");
                if (isHidden) {
                    body.classList.remove("hidden");
                    chevron.classList.add("rotate-180");
                } else {
                    body.classList.add("hidden");
                    chevron.classList.remove("rotate-180");
                }
            });
        });
    }

    // =========================================================================
    // 4. CHẾ ĐỘ BẢNG TRA CỨU TOÀN BỘ (RAW TABLE VIEW)
    // =========================================================================

    function updateTableHeaders() {
        if (!tableHead) return;
        if (viewMode === "grouped") {
            tableHead.innerHTML = `
                <tr>
                    <th class="py-3 px-4 w-16 text-center">Năm</th>
                    <th class="py-3 px-4 w-28">Trường</th>
                    <th class="py-3 px-4 w-60">Ngành Tuyển Sinh</th>
                    <th class="py-3 px-4 min-w-[360px]">Điểm Xét Tuyển Tất Cả Các Phương Thức</th>
                    <th class="py-3 px-4 w-32 text-center">Chỉ Tiêu / Ghi Chú</th>
                </tr>
            `;
        } else {
            tableHead.innerHTML = `
                <tr>
                    <th class="py-3 px-4 w-16 text-center">Năm</th>
                    <th class="py-3 px-4 w-28">Trường</th>
                    <th class="py-3 px-4 min-w-[200px]">Tên Ngành / Chuyên Ngành</th>
                    <th class="py-3 px-4 min-w-[140px]">Phương Thức</th>
                    <th class="py-3 px-4 w-28 text-center">Tổ Hợp Môn</th>
                    <th class="py-3 px-4 w-28 text-center">Điểm Chuẩn</th>
                    <th class="py-3 px-4 min-w-[150px]">Chỉ Tiêu / Ghi Chú</th>
                </tr>
            `;
        }
    }

    async function loadStaticDataIfNeeded() {
        if (!staticScoresData) {
            try {
                const res = await fetch(`${STATIC_BASE}/scores_grouped.json`);
                if (res.ok) {
                    staticScoresData = await res.json();
                }
            } catch (e) {
                console.warn("Không thể tải static data:", e);
            }
        }
    }

    async function loadStats() {
        try {
            const url = isStaticMode ? `${STATIC_BASE}/stats.json` : "/api/stats";
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (statUniversities) statUniversities.textContent = (data.total_universities || 0).toLocaleString();
                if (statScores) statScores.textContent = (data.total_scores || 0).toLocaleString();
            }
        } catch (e) {
            console.error("Lỗi tải stats:", e);
        }
    }

    async function fetchScores() {
        await loadStaticDataIfNeeded();
        if (!staticScoresData) return;

        const [sort_by, sort_order] = (sortBySelect ? sortBySelect.value : "cutoff_score-DESC").split("-");

        let items = [...staticScoresData];

        // Sắp xếp
        items.sort((a, b) => {
            if (sort_by === "cutoff_score") {
                const maxScoreA = Math.max(...(a.methods || []).map(m => m.cutoff_score || 0), 0);
                const maxScoreB = Math.max(...(b.methods || []).map(m => m.cutoff_score || 0), 0);
                return sort_order === "ASC" ? maxScoreA - maxScoreB : maxScoreB - maxScoreA;
            } else if (sort_by === "year") {
                return sort_order === "ASC" ? a.year - b.year : b.year - a.year;
            } else if (sort_by === "major_name") {
                return sort_order === "ASC" 
                    ? (a.major_name || "").localeCompare(b.major_name || "", "vi")
                    : (b.major_name || "").localeCompare(a.major_name || "", "vi");
            }
            return 0;
        });

        const total = items.length;
        const pageSize = 20;
        totalPages = Math.max(1, Math.ceil(total / pageSize));
        const startIdx = (currentPage - 1) * pageSize;
        const pagedItems = items.slice(startIdx, startIdx + pageSize);

        if (currentPageDisplay) currentPageDisplay.textContent = currentPage;
        if (totalPagesDisplay) totalPagesDisplay.textContent = totalPages;
        if (resultsCount) resultsCount.textContent = `Tổng cộng ${total.toLocaleString()} ngành`;

        if (viewMode === "grouped") {
            renderGroupedTable(pagedItems);
        } else {
            const flatItems = [];
            pagedItems.forEach(item => {
                (item.methods || []).forEach(m => {
                    flatItems.push({
                        year: item.year,
                        university_code: item.university_code,
                        university_name: item.university_name,
                        major_code: item.major_code,
                        major_name: item.major_name,
                        method: m.method,
                        subject_group: m.subject_group,
                        cutoff_score: m.cutoff_score,
                        cutoff_score_text: m.cutoff_score_text,
                        quota: item.quota,
                        notes: m.notes
                    });
                });
            });
            renderFlatTable(flatItems);
        }
        renderPagination();
    }

    function renderGroupedTable(items) {
        if (!tableBody) return;
        if (!items || items.length === 0) {
            tableBody.innerHTML = "";
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        let html = "";

        items.forEach(item => {
            const is2026 = item.year === 2026;
            const yearBadge = is2026
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">2026</span>`
                : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">${item.year}</span>`;

            const methods = item.methods || [];
            let methodsHtml = "";

            if (methods.length === 0) {
                methodsHtml = `<span class="text-xs text-slate-400">Chưa có điểm</span>`;
            } else {
                const methodCards = methods.map(m => {
                    const mName = m.method || "Xét tuyển";
                    let cardBg = "bg-blue-50/70 border-blue-200/80 text-blue-900";
                    if (mName.includes("TSA") || mName.includes("ĐGTD")) cardBg = "bg-purple-50/70 border-purple-200/80 text-purple-900";
                    else if (mName.includes("HSA") || mName.includes("ĐGNL")) cardBg = "bg-amber-50/70 border-amber-200/80 text-amber-900";
                    else if (mName.includes("học bạ")) cardBg = "bg-rose-50/70 border-rose-200/80 text-rose-900";

                    const scoreDisplay = m.cutoff_score !== null ? m.cutoff_score : (m.cutoff_score_text || "-");
                    let subjHtml = m.subject_group ? `<span class="subject-pill">${escapeHtml(m.subject_group)}</span>` : "";

                    return `
                    <div class="method-card-item ${cardBg} flex-1 min-w-[170px] max-w-[280px]">
                        <div class="flex items-center justify-between gap-1 text-[11px] font-bold">
                            <span class="truncate" title="${escapeHtml(mName)}">${escapeHtml(mName)}</span>
                        </div>
                        <div class="flex items-center justify-between gap-2 mt-1">
                            <span class="text-base font-extrabold text-slate-900">${scoreDisplay}</span>
                            <div>${subjHtml}</div>
                        </div>
                    </div>
                    `;
                }).join("");

                methodsHtml = `<div class="flex flex-wrap gap-2 py-1">${methodCards}</div>`;
            }

            let noteHtml = item.quota ? `<span class="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold inline-block">Chỉ tiêu: ${item.quota}</span>` : "<span class='text-slate-400 text-xs'>-</span>";

            html += `
            <tr class="hover:bg-slate-50/90 transition-colors border-b border-slate-100">
                <td class="py-3 px-4 text-center align-top pt-4">${yearBadge}</td>
                <td class="py-3 px-4 align-top pt-4">
                    <span class="font-extrabold text-blue-700 text-sm">${item.university_code}</span>
                    <p class="text-xs text-slate-600 line-clamp-2 mt-0.5" title="${escapeHtml(item.university_name)}">${escapeHtml(item.university_name)}</p>
                </td>
                <td class="py-3 px-4 align-top pt-4">
                    <div class="font-bold text-slate-900 text-sm leading-snug">${escapeHtml(item.major_name)}</div>
                    ${item.major_code ? `<span class="inline-block text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded mt-1">Mã: ${item.major_code}</span>` : ""}
                </td>
                <td class="py-3 px-4 align-top">${methodsHtml}</td>
                <td class="py-3 px-4 text-center align-top pt-4">${noteHtml}</td>
            </tr>
            `;
        });

        tableBody.innerHTML = html;
    }

    function renderFlatTable(items) {
        if (!tableBody) return;
        if (!items || items.length === 0) {
            tableBody.innerHTML = "";
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        let html = "";

        items.forEach(item => {
            const displayScore = item.cutoff_score !== null ? item.cutoff_score : (item.cutoff_score_text || "-");
            let subjHtml = item.subject_group ? `<span class="subject-pill">${escapeHtml(item.subject_group)}</span>` : "-";

            html += `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 text-center">${item.year}</td>
                <td class="py-3 px-4">
                    <span class="font-bold text-blue-700">${item.university_code}</span>
                    <p class="text-xs text-slate-500 line-clamp-1">${escapeHtml(item.university_name)}</p>
                </td>
                <td class="py-3 px-4">
                    <div class="font-medium text-slate-800">${escapeHtml(item.major_name)}</div>
                </td>
                <td class="py-3 px-4">
                    <span class="method-tag">${escapeHtml(item.method)}</span>
                </td>
                <td class="py-3 px-4 text-center">${subjHtml}</td>
                <td class="py-3 px-4 text-center">
                    <span class="score-badge score-high">${displayScore}</span>
                </td>
                <td class="py-3 px-4">${item.quota ? `Chỉ tiêu: ${item.quota}` : '-'}</td>
            </tr>
            `;
        });

        tableBody.innerHTML = html;
    }

    function renderPagination() {
        if (!paginationControls) return;
        paginationControls.innerHTML = "";
        if (totalPages <= 1) return;

        const btnPrev = document.createElement("button");
        btnPrev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        btnPrev.className = `px-2.5 py-1.5 rounded border border-slate-200 ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}`;
        btnPrev.disabled = currentPage === 1;
        btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; fetchScores(); } };
        paginationControls.appendChild(btnPrev);

        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        for (let p = startPage; p <= endPage; p++) {
            const btn = document.createElement("button");
            btn.textContent = p;
            btn.className = `px-3 py-1.5 rounded font-medium border ${p === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`;
            btn.onclick = () => { currentPage = p; fetchScores(); };
            paginationControls.appendChild(btn);
        }

        const btnNext = document.createElement("button");
        btnNext.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        btnNext.className = `px-2.5 py-1.5 rounded border border-slate-200 ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}`;
        btnNext.disabled = currentPage === totalPages;
        btnNext.onclick = () => { if (currentPage < totalPages) { currentPage++; fetchScores(); } };
        paginationControls.appendChild(btnNext);
    }

    function exportCSV() {
        if (!staticScoresData) return;
        const rows = [];
        staticScoresData.forEach(item => {
            (item.methods || []).forEach(m => {
                rows.push([
                    item.year,
                    `"${item.university_code}"`,
                    `"${(item.university_name || '').replace(/"/g, '""')}"`,
                    `"${item.major_code || ''}"`,
                    `"${(item.major_name || '').replace(/"/g, '""')}"`,
                    `"${(m.method || '').replace(/"/g, '""')}"`,
                    `"${m.subject_group || ''}"`,
                    m.cutoff_score !== null ? m.cutoff_score : `"${m.cutoff_score_text || ''}"`,
                    `"${item.quota || ''}"`,
                    `"${(m.notes || '').replace(/"/g, '""')}"`
                ]);
            });
        });

        const headers = ["Năm", "Mã trường", "Tên trường", "Mã ngành", "Tên ngành", "Phương thức", "Tổ hợp môn", "Điểm chuẩn", "Chỉ tiêu", "Ghi chú"];
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `diem_chuan_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function removeVietnameseTones(str) {
        if (!str) return "";
        str = str.toLowerCase();
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        str = str.replace(/đ/g, "d");
        return str;
    }

    function escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
