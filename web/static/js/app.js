/**
 * Frontend logic for Đại Học Benchmark Lookup
 * Hỗ trợ 2 chế độ (Dual-Mode):
 *  1. Chế độ Dynamic (FastAPI backend khi chạy local hoặc VPS/Server)
 *  2. Chế độ 100% Static (GitHub Pages, tải dữ liệu JSON tĩnh và tìm kiếm siêu tốc trên client)
 */

document.addEventListener("DOMContentLoaded", () => {
    let currentPage = 1;
    let totalPages = 1;
    let debounceTimer = null;
    let viewMode = "grouped"; // "grouped" (mặc định: tất cả phương thức trên 1 hàng) hoặc "flat"

    // Kiểm tra môi trường Static (GitHub Pages hoặc mở file trực tiếp)
    let isStaticMode = window.location.hostname.endsWith("github.io") || 
                       window.location.protocol === "file:" || 
                       window.location.port === "" && !window.location.hostname.includes("localhost");
    let staticScoresData = null;
    const STATIC_BASE = "./data/static_data";

    // DOM Elements
    const keywordInput = document.getElementById("filter-keyword");
    const universitySelect = document.getElementById("filter-university");
    const yearSelect = document.getElementById("filter-year");
    const methodSelect = document.getElementById("filter-method");
    const subjectSelect = document.getElementById("filter-subject");
    const minScoreInput = document.getElementById("filter-min-score");
    const maxScoreInput = document.getElementById("filter-max-score");
    const sortBySelect = document.getElementById("sort-by");
    const btnSearch = document.getElementById("btn-search");
    const btnReset = document.getElementById("btn-reset");
    const btnExportCsv = document.getElementById("btn-export-csv");

    const btnViewGrouped = document.getElementById("btn-view-grouped");
    const btnViewFlat = document.getElementById("btn-view-flat");
    const tableHead = document.getElementById("scores-table-head");
    const tableBody = document.getElementById("scores-table-body");
    const emptyState = document.getElementById("empty-state");
    const loadingSpinner = document.getElementById("loading-spinner");
    const resultsCount = document.getElementById("results-count");
    const activeFilterBadge = document.getElementById("active-filter-badge");

    const currentPageDisplay = document.getElementById("current-page-display");
    const totalPagesDisplay = document.getElementById("total-pages-display");
    const paginationControls = document.getElementById("pagination-controls");

    // Stat Elements
    const statUniversities = document.getElementById("stat-universities");
    const statScores = document.getElementById("stat-scores");

    // 1. Initial Data Fetching
    loadStats();
    loadUniversities();
    loadMethods();
    loadSubjects();
    fetchScores();

    // 2. Event Listeners
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

    keywordInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            fetchScores();
        }, 250);
    });

    [universitySelect, yearSelect, methodSelect, subjectSelect, sortBySelect].forEach(el => {
        el.addEventListener("change", () => {
            currentPage = 1;
            fetchScores();
        });
    });

    [minScoreInput, maxScoreInput].forEach(el => {
        el.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentPage = 1;
                fetchScores();
            }, 350);
        });
    });

    btnSearch.addEventListener("click", () => {
        currentPage = 1;
        fetchScores();
    });

    btnReset.addEventListener("click", () => {
        keywordInput.value = "";
        universitySelect.value = "";
        yearSelect.value = "";
        methodSelect.value = "";
        subjectSelect.value = "";
        minScoreInput.value = "";
        maxScoreInput.value = "";
        sortBySelect.value = "cutoff_score-DESC";
        currentPage = 1;
        fetchScores();
    });

    btnExportCsv.addEventListener("click", () => {
        exportCSV();
    });

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

    // 3. API & Static Data Functions
    async function loadStats() {
        try {
            const url = isStaticMode ? `${STATIC_BASE}/stats.json` : "/api/stats";
            const res = await fetch(url);
            if (!res.ok && !isStaticMode) {
                isStaticMode = true;
                return loadStats();
            }
            const data = await res.json();
            statUniversities.textContent = (data.total_universities || 0).toLocaleString();
            statScores.textContent = (data.total_scores || 0).toLocaleString();
        } catch (e) {
            if (!isStaticMode) {
                isStaticMode = true;
                return loadStats();
            }
            console.error("Lỗi tải stats:", e);
        }
    }

    async function loadUniversities() {
        try {
            const url = isStaticMode ? `${STATIC_BASE}/universities.json` : "/api/universities";
            const res = await fetch(url);
            if (!res.ok && !isStaticMode) {
                isStaticMode = true;
                return loadUniversities();
            }
            const data = await res.json();
            let html = '<option value="">Tất cả các trường</option>';
            data.forEach(u => {
                const countText = u.total_records ? ` (${u.total_records} điểm)` : "";
                html += `<option value="${u.code}">${u.code} - ${u.name}${countText}</option>`;
            });
            universitySelect.innerHTML = html;
        } catch (e) {
            if (!isStaticMode) {
                isStaticMode = true;
                return loadUniversities();
            }
            console.error("Lỗi tải universities:", e);
        }
    }

    async function loadMethods() {
        try {
            const url = isStaticMode ? `${STATIC_BASE}/methods.json` : "/api/methods";
            const res = await fetch(url);
            if (!res.ok && !isStaticMode) {
                isStaticMode = true;
                return loadMethods();
            }
            const data = await res.json();
            let html = '<option value="">Tất cả phương thức</option>';
            data.forEach(m => {
                html += `<option value="${m}">${m}</option>`;
            });
            methodSelect.innerHTML = html;
        } catch (e) {
            if (!isStaticMode) {
                isStaticMode = true;
                return loadMethods();
            }
            console.error("Lỗi tải methods:", e);
        }
    }

    async function loadSubjects() {
        try {
            const url = isStaticMode ? `${STATIC_BASE}/subjects.json` : "/api/subjects";
            const res = await fetch(url);
            if (!res.ok && !isStaticMode) {
                isStaticMode = true;
                return loadSubjects();
            }
            const data = await res.json();
            let html = '<option value="">Tất cả tổ hợp</option>';
            data.forEach(s => {
                html += `<option value="${s}">${s}</option>`;
            });
            subjectSelect.innerHTML = html;
        } catch (e) {
            if (!isStaticMode) {
                isStaticMode = true;
                return loadSubjects();
            }
            console.error("Lỗi tải subjects:", e);
        }
    }

    async function fetchScores() {
        loadingSpinner.classList.remove("hidden");

        const [sort_by, sort_order] = sortBySelect.value.split("-");
        const kw = keywordInput.value.trim();
        const uni = universitySelect.value;
        const yr = yearSelect.value;
        const mth = methodSelect.value;
        const sbj = subjectSelect.value;
        const minS = minScoreInput.value ? parseFloat(minScoreInput.value) : null;
        const maxS = maxScoreInput.value ? parseFloat(maxScoreInput.value) : null;

        const hasFilters = kw || uni || yr || mth || sbj || minS !== null || maxS !== null;
        if (hasFilters) {
            activeFilterBadge.classList.remove("hidden");
        } else {
            activeFilterBadge.classList.add("hidden");
        }

        // ==========================================
        // 1. CHẾ ĐỘ TĨNH (GITHUB PAGES / STATIC)
        // ==========================================
        if (isStaticMode) {
            try {
                if (!staticScoresData) {
                    const res = await fetch(`${STATIC_BASE}/scores_grouped.json`);
                    staticScoresData = await res.json();
                }

                const kwNorm = removeVietnameseTones(kw);

                // Lọc dữ liệu ngay trên trình duyệt (client-side)
                let filtered = staticScoresData.filter(item => {
                    if (uni && item.university_code !== uni) return false;
                    if (yr && item.year !== parseInt(yr)) return false;

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
                        if (!matchKw) return false;
                    }

                    if (mth) {
                        const matchMth = (item.methods || []).some(m => (m.method || "").toLowerCase().includes(mth.toLowerCase()));
                        if (!matchMth) return false;
                    }

                    if (sbj) {
                        const matchSbj = (item.methods || []).some(m => (m.subject_group || "").includes(sbj));
                        if (!matchSbj) return false;
                    }

                    if (minS !== null) {
                        const matchMin = (item.methods || []).some(m => m.cutoff_score !== null && m.cutoff_score >= minS);
                        if (!matchMin) return false;
                    }

                    if (maxS !== null) {
                        const matchMax = (item.methods || []).some(m => m.cutoff_score !== null && m.cutoff_score <= maxS);
                        if (!matchMax) return false;
                    }

                    return true;
                });

                // Sắp xếp
                filtered.sort((a, b) => {
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

                const total = filtered.length;
                const pageSize = 20;
                totalPages = Math.max(1, Math.ceil(total / pageSize));
                if (currentPage > totalPages) currentPage = totalPages;

                const startIdx = (currentPage - 1) * pageSize;
                const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

                currentPageDisplay.textContent = currentPage;
                totalPagesDisplay.textContent = totalPages;
                const unitName = viewMode === "grouped" ? "ngành" : "kết quả";
                resultsCount.textContent = `Tìm thấy ${total.toLocaleString()} ${unitName}`;

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
            } catch (e) {
                console.error("Lỗi lọc static scores:", e);
                resultsCount.textContent = "Lỗi khi lấy dữ liệu";
            } finally {
                loadingSpinner.classList.add("hidden");
            }
            return;
        }

        // ==========================================
        // 2. CHẾ ĐỘ DYNAMIC (FASTAPI SERVER)
        // ==========================================
        const params = new URLSearchParams({
            page: currentPage,
            page_size: 20,
            sort_by: sort_by || "cutoff_score",
            sort_order: sort_order || "DESC",
            view: viewMode
        });
        if (kw) params.append("keyword", kw);
        if (uni) params.append("university_code", uni);
        if (yr) params.append("year", yr);
        if (mth) params.append("method", mth);
        if (sbj) params.append("subject_group", sbj);
        if (minS !== null) params.append("min_score", minS);
        if (maxS !== null) params.append("max_score", maxS);

        try {
            const res = await fetch(`/api/scores?${params.toString()}`);
            if (!res.ok) {
                isStaticMode = true;
                return fetchScores();
            }
            const data = await res.json();

            totalPages = data.total_pages || 1;
            currentPageDisplay.textContent = data.page;
            totalPagesDisplay.textContent = totalPages;
            const unitName = viewMode === "grouped" ? "ngành" : "kết quả";
            resultsCount.textContent = `Tìm thấy ${data.total.toLocaleString()} ${unitName}`;

            if (viewMode === "grouped") {
                renderGroupedTable(data.items);
            } else {
                renderFlatTable(data.items);
            }
            renderPagination();
        } catch (e) {
            // Tự động chuyển qua chế độ tĩnh nếu API backend không phản hồi
            isStaticMode = true;
            return fetchScores();
        } finally {
            loadingSpinner.classList.add("hidden");
        }
    }

    /**
     * RENDER DẠNG GỘP: 1 ngành hiển thị TẤT CẢ các phương thức xét tuyển trên cùng 1 hàng
     */
    function renderGroupedTable(items) {
        if (!items || items.length === 0) {
            tableBody.innerHTML = "";
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        let html = "";

        items.forEach(item => {
            const is2026 = item.year === 2026;
            const yearBadge = is2026
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">2026 <span class="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span></span>`
                : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">${item.year}</span>`;

            // Render danh sách các phương thức trong cùng 1 ô
            const methods = item.methods || [];
            let methodsHtml = "";

            if (methods.length === 0) {
                methodsHtml = `<span class="text-xs text-slate-400">Chưa có thông tin điểm</span>`;
            } else {
                const methodCards = methods.map(m => {
                    let cardBg = "bg-slate-50 border-slate-200 text-slate-700";
                    let icon = "fa-graduation-cap text-blue-500";
                    const mName = m.method || "Xét tuyển";
                    
                    if (mName.includes("THPT") || mName.includes("100")) {
                        cardBg = "bg-blue-50/70 border-blue-200/80 text-blue-900";
                        icon = "fa-book-open text-blue-600";
                    } else if (mName.includes("TSA") || mName.includes("ĐGTD")) {
                        cardBg = "bg-purple-50/70 border-purple-200/80 text-purple-900";
                        icon = "fa-brain text-purple-600";
                    } else if (mName.includes("HSA") || mName.includes("ĐGNL") || mName.includes("V-ACT")) {
                        cardBg = "bg-amber-50/70 border-amber-200/80 text-amber-900";
                        icon = "fa-bolt text-amber-600";
                    } else if (mName.includes("quốc tế") || mName.includes("CCQT") || mName.includes("402")) {
                        cardBg = "bg-emerald-50/70 border-emerald-200/80 text-emerald-900";
                        icon = "fa-globe text-emerald-600";
                    } else if (mName.includes("kết hợp")) {
                        cardBg = "bg-indigo-50/70 border-indigo-200/80 text-indigo-900";
                        icon = "fa-handshake text-indigo-600";
                    } else if (mName.includes("học bạ")) {
                        cardBg = "bg-rose-50/70 border-rose-200/80 text-rose-900";
                        icon = "fa-id-card text-rose-600";
                    }

                    const scoreDisplay = m.cutoff_score !== null ? m.cutoff_score : (m.cutoff_score_text || "-");

                    let subjHtml = "";
                    if (m.subject_group) {
                        const sList = m.subject_group.split(";").map(s => s.trim()).filter(Boolean);
                        if (sList.length > 2) {
                            subjHtml = `<span class="subject-pill">${escapeHtml(sList[0])}</span> <span class="text-[10px] text-slate-400 font-medium">+${sList.length - 1}</span>`;
                        } else {
                            subjHtml = sList.map(s => `<span class="subject-pill">${escapeHtml(s)}</span>`).join(" ");
                        }
                    }

                    return `
                    <div class="method-card-item ${cardBg} flex-1 min-w-[170px] max-w-[280px]">
                        <div class="flex items-center justify-between gap-1 text-[11px] font-bold">
                            <span class="truncate flex items-center gap-1.5" title="${escapeHtml(mName)}">
                                <i class="fa-solid ${icon}"></i> ${escapeHtml(mName)}
                            </span>
                        </div>
                        <div class="flex items-center justify-between gap-2 mt-1">
                            <span class="text-base font-extrabold text-slate-900 tracking-tight">${scoreDisplay}</span>
                            <div>${subjHtml}</div>
                        </div>
                        ${m.notes ? `<div class="text-[10px] text-slate-500 mt-1 line-clamp-1 italic border-t border-slate-200/40 pt-0.5" title="${escapeHtml(m.notes)}">${escapeHtml(m.notes)}</div>` : ''}
                    </div>
                    `;
                }).join("");

                methodsHtml = `<div class="flex flex-wrap gap-2 py-1">${methodCards}</div>`;
            }

            // Quota / Notes
            let noteHtml = "";
            if (item.quota) {
                noteHtml += `<span class="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold border border-blue-200/60 inline-block mb-1">Chỉ tiêu: ${item.quota}</span><br>`;
            }
            if (!noteHtml) noteHtml = "<span class='text-slate-400 text-xs'>-</span>";

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
                <td class="py-3 px-4 align-top">
                    ${methodsHtml}
                </td>
                <td class="py-3 px-4 text-center align-top pt-4">${noteHtml}</td>
            </tr>
            `;
        });

        tableBody.innerHTML = html;
    }

    /**
     * RENDER DẠNG PHẲNG (Từng dòng 1 phương thức)
     */
    function renderFlatTable(items) {
        if (!items || items.length === 0) {
            tableBody.innerHTML = "";
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        let html = "";

        items.forEach(item => {
            const is2026 = item.year === 2026;
            const yearBadge = is2026
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">2026 <span class="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span></span>`
                : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">${item.year}</span>`;

            let scoreClass = "score-general";
            const val = item.cutoff_score;
            if (val !== null) {
                if (val >= 25 && val <= 30) scoreClass = "score-high";
                else if (val >= 20) scoreClass = "score-medium";
            }
            const displayScore = val !== null ? val : (item.cutoff_score_text || "-");

            let subjectHtml = "-";
            if (item.subject_group) {
                const parts = item.subject_group.split(";").map(s => s.trim()).filter(Boolean);
                if (parts.length > 3) {
                    subjectHtml = `<span class="subject-pill">${parts[0]}</span> <span class="text-xs text-slate-400">+${parts.length - 1}</span>`;
                } else {
                    subjectHtml = parts.map(p => `<span class="subject-pill">${p}</span>`).join(" ");
                }
            }

            let noteHtml = "";
            if (item.quota) {
                noteHtml += `<span class="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium">Chỉ tiêu: ${item.quota}</span> `;
            }
            if (item.notes) {
                noteHtml += `<span class="text-xs text-slate-500" title="${escapeHtml(item.notes)}">${escapeHtml(truncate(item.notes, 50))}</span>`;
            }
            if (!noteHtml) noteHtml = "<span class='text-slate-300'>-</span>";

            html += `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 text-center">${yearBadge}</td>
                <td class="py-3 px-4">
                    <span class="font-bold text-blue-700">${item.university_code}</span>
                    <p class="text-xs text-slate-500 line-clamp-1" title="${escapeHtml(item.university_name)}">${escapeHtml(item.university_name)}</p>
                </td>
                <td class="py-3 px-4">
                    <div class="font-medium text-slate-800">${escapeHtml(item.major_name)}</div>
                    ${item.major_code ? `<span class="text-[11px] font-mono text-slate-400">${item.major_code}</span>` : ""}
                </td>
                <td class="py-3 px-4">
                    <span class="method-tag" title="${escapeHtml(item.method)}">${escapeHtml(item.method)}</span>
                </td>
                <td class="py-3 px-4 text-center">${subjectHtml}</td>
                <td class="py-3 px-4 text-center">
                    <span class="score-badge ${scoreClass}">${displayScore}</span>
                </td>
                <td class="py-3 px-4">${noteHtml}</td>
            </tr>
            `;
        });

        tableBody.innerHTML = html;
    }

    function renderPagination() {
        paginationControls.innerHTML = "";
        if (totalPages <= 1) return;

        // Button Prev
        const btnPrev = document.createElement("button");
        btnPrev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        btnPrev.className = `px-2.5 py-1.5 rounded border border-slate-200 ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}`;
        btnPrev.disabled = currentPage === 1;
        btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; fetchScores(); } };
        paginationControls.appendChild(btnPrev);

        // Page Numbers
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let p = startPage; p <= endPage; p++) {
            const btn = document.createElement("button");
            btn.textContent = p;
            btn.className = `px-3 py-1.5 rounded font-medium border ${p === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`;
            btn.onclick = () => { currentPage = p; fetchScores(); };
            paginationControls.appendChild(btn);
        }

        // Button Next
        const btnNext = document.createElement("button");
        btnNext.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        btnNext.className = `px-2.5 py-1.5 rounded border border-slate-200 ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}`;
        btnNext.disabled = currentPage === totalPages;
        btnNext.onclick = () => { if (currentPage < totalPages) { currentPage++; fetchScores(); } };
        paginationControls.appendChild(btnNext);
    }

    function exportCSV() {
        // Trong chế độ Static hoặc Dynamic, lấy toàn bộ danh sách điểm để xuất CSV
        if (isStaticMode && staticScoresData) {
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

            downloadCSVContent(rows);
            return;
        }

        const [sort_by, sort_order] = sortBySelect.value.split("-");
        const params = new URLSearchParams({
            page: 1,
            page_size: 10000,
            sort_by: sort_by || "cutoff_score",
            sort_order: sort_order || "DESC",
            view: "flat"
        });

        if (keywordInput.value.trim()) params.append("keyword", keywordInput.value.trim());
        if (universitySelect.value) params.append("university_code", universitySelect.value);
        if (yearSelect.value) params.append("year", yearSelect.value);
        if (methodSelect.value) params.append("method", methodSelect.value);
        if (subjectSelect.value) params.append("subject_group", subjectSelect.value);
        if (minScoreInput.value) params.append("min_score", minScoreInput.value);
        if (maxScoreInput.value) params.append("max_score", maxScoreInput.value);

        fetch(`/api/scores?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                if (!data.items || data.items.length === 0) {
                    alert("Không có dữ liệu để xuất.");
                    return;
                }
                const rows = data.items.map(item => [
                    item.year,
                    `"${item.university_code}"`,
                    `"${(item.university_name || '').replace(/"/g, '""')}"`,
                    `"${item.major_code || ''}"`,
                    `"${(item.major_name || '').replace(/"/g, '""')}"`,
                    `"${(item.method || '').replace(/"/g, '""')}"`,
                    `"${item.subject_group || ''}"`,
                    item.cutoff_score !== null ? item.cutoff_score : `"${item.cutoff_score_text || ''}"`,
                    `"${item.quota || ''}"`,
                    `"${(item.notes || '').replace(/"/g, '""')}"`
                ]);
                downloadCSVContent(rows);
            })
            .catch(e => {
                alert("Lỗi xuất CSV: " + e.message);
            });
    }

    function downloadCSVContent(rows) {
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

    function truncate(str, max) {
        if (!str) return "";
        return str.length > max ? str.slice(0, max) + "..." : str;
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
