/**
 * Frontend logic for Đại Học Benchmark Lookup
 * - Tab 1: Xét tuyển điểm thi THPT theo tổ hợp môn (Khối A, B, C, D) + Máy tính điểm từng môn
 * - Tab 2: Tách riêng các phương thức xét tuyển khác (ĐGNL, ĐGTD, Học bạ, CCQT...)
 * - Tab 3: Bảng tra cứu toàn bộ
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

    // Môn học cấu thành từng tổ hợp
    const COMBO_SUBJECTS = {
        "A00": ["toan", "ly", "hoa"],
        "A01": ["toan", "ly", "anh"],
        "A02": ["toan", "ly", "sinh"],
        "A03": ["toan", "ly", "su"],
        "A04": ["toan", "ly", "dia"],
        "A05": ["toan", "hoa", "su"],
        "A06": ["toan", "hoa", "dia"],
        "A07": ["toan", "su", "dia"],
        "A08": ["toan", "su", "gdcd"],
        "A09": ["toan", "dia", "gdcd"],
        "A10": ["toan", "ly", "gdcd"],
        "A11": ["toan", "hoa", "gdcd"],
        "A16": ["toan", "van"],
        "B00": ["toan", "hoa", "sinh"],
        "B01": ["toan", "sinh", "su"],
        "B02": ["toan", "sinh", "dia"],
        "B03": ["toan", "sinh", "van"],
        "B04": ["toan", "sinh", "gdcd"],
        "B08": ["toan", "sinh", "anh"],
        "C00": ["van", "su", "dia"],
        "C01": ["van", "toan", "ly"],
        "C02": ["van", "toan", "hoa"],
        "C03": ["van", "toan", "su"],
        "C04": ["van", "toan", "dia"],
        "C14": ["van", "toan", "gdcd"],
        "C19": ["van", "su", "gdcd"],
        "C20": ["van", "dia", "gdcd"],
        "D01": ["toan", "van", "anh"],
        "D02": ["toan", "van"],
        "D03": ["toan", "van"],
        "D04": ["toan", "van"],
        "D05": ["toan", "van"],
        "D06": ["toan", "van"],
        "D07": ["toan", "hoa", "anh"],
        "D08": ["toan", "sinh", "anh"],
        "D09": ["toan", "su", "anh"],
        "D10": ["toan", "dia", "anh"],
        "D14": ["van", "su", "anh"],
        "D15": ["van", "dia", "anh"],
        "D66": ["van", "gdcd", "anh"],
        "D78": ["van", "anh"],
        "D84": ["toan", "gdcd", "anh"],
        "X01": ["toan", "anh"],
        "X02": ["toan", "ly"],
        "X06": ["toan", "hoa"],
        "X26": ["toan", "sinh"],
        "V00": ["toan", "ly"],
        "V01": ["toan", "van"],
        "H01": ["toan", "van"]
    };

    // DOM Elements - Navigation Tabs
    const tabNavThpt = document.getElementById("tab-nav-thpt");
    const tabNavOthers = document.getElementById("tab-nav-others");
    const tabNavTable = document.getElementById("tab-nav-table");

    const sectionThpt = document.getElementById("section-thpt");
    const sectionOthers = document.getElementById("section-others");
    const sectionTable = document.getElementById("section-table");

    // DOM Elements - Tab 1: THPT
    const selectThptCombo = document.getElementById("select-thpt-combo");
    const inputThptScore = document.getElementById("input-thpt-score");
    const selectThptRegion = document.getElementById("select-thpt-region");
    const selectThptUniversity = document.getElementById("select-thpt-university");
    const selectChanceLevel = document.getElementById("select-chance-level");
    const filterThptKeyword = document.getElementById("filter-thpt-keyword");
    const filterThptYear = document.getElementById("filter-thpt-year");
    const btnClearThpt = document.getElementById("btn-clear-thpt");
    const quickScoreButtons = document.querySelectorAll(".btn-quick-score");

    const thptSummaryBar = document.getElementById("thpt-summary-bar");
    const thptSummaryText = document.getElementById("thpt-summary-text");
    const promptThptEmpty = document.getElementById("prompt-thpt-empty");
    const thptSchoolsContainer = document.getElementById("thpt-schools-container");

    const btnThptExpandAll = document.getElementById("btn-thpt-expand-all");
    const btnThptCollapseAll = document.getElementById("btn-thpt-collapse-all");

    // Subject Inputs
    const subInputs = {
        toan: document.getElementById("m-toan"),
        ly: document.getElementById("m-ly"),
        hoa: document.getElementById("m-hoa"),
        sinh: document.getElementById("m-sinh"),
        van: document.getElementById("m-van"),
        anh: document.getElementById("m-anh"),
        su: document.getElementById("m-su"),
        dia: document.getElementById("m-dia"),
        gdcd: document.getElementById("m-gdcd")
    };

    // DOM Elements - Tab 2: Others
    const selectOtherMethodType = document.getElementById("select-other-method-type");
    const inputOtherScore = document.getElementById("input-other-score");
    const selectOtherUniversity = document.getElementById("select-other-university");
    const filterOtherKeyword = document.getElementById("filter-other-keyword");
    const filterOtherYear = document.getElementById("filter-other-year");
    const btnClearOthers = document.getElementById("btn-clear-others");
    const othersSummaryText = document.getElementById("others-summary-text");
    const othersSchoolsContainer = document.getElementById("others-schools-container");

    // DOM Elements - Tab 3: Table Mode
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
    loadStaticDataIfNeeded().then(() => {
        populateUniversitiesDropdown();
    });

    // 2. Navigation Tab Switcher
    function setActiveTab(tab) {
        // Reset classes
        [tabNavThpt, tabNavOthers, tabNavTable].forEach(b => {
            b.className = "flex-1 min-w-[220px] py-2.5 px-4 rounded-xl font-bold text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-2 transition-all";
        });
        [sectionThpt, sectionOthers, sectionTable].forEach(s => s.classList.add("hidden"));

        if (tab === "thpt") {
            tabNavThpt.className = "flex-1 min-w-[220px] py-2.5 px-4 rounded-xl font-extrabold text-sm bg-blue-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all";
            sectionThpt.classList.remove("hidden");
            if (selectOtherUniversity && selectThptUniversity && selectOtherUniversity.value && !selectThptUniversity.value) {
                selectThptUniversity.value = selectOtherUniversity.value;
            }
            handleThptAnalysis();
        } else if (tab === "others") {
            tabNavOthers.className = "flex-1 min-w-[220px] py-2.5 px-4 rounded-xl font-extrabold text-sm bg-purple-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all";
            sectionOthers.classList.remove("hidden");
            if (selectThptUniversity && selectOtherUniversity && selectThptUniversity.value && !selectOtherUniversity.value) {
                selectOtherUniversity.value = selectThptUniversity.value;
            }
            handleOthersAnalysis();
        } else if (tab === "table") {
            tabNavTable.className = "sm:w-auto py-2.5 px-4 rounded-xl font-extrabold text-sm bg-emerald-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all";
            sectionTable.classList.remove("hidden");
            fetchScores();
        }
    }

    tabNavThpt.addEventListener("click", () => setActiveTab("thpt"));
    tabNavOthers.addEventListener("click", () => setActiveTab("others"));
    tabNavTable.addEventListener("click", () => setActiveTab("table"));

    // 3. Tab 1: THPT Event Listeners
    inputThptScore.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleThptAnalysis();
        }, 200);
    });

    selectThptCombo.addEventListener("change", () => {
        const cVal = selectThptCombo.value.trim();
        if (cVal === "K00") {
            inputThptScore.placeholder = "Ví dụ: 68.5 (Thang 100 ĐGTD)";
            inputThptScore.max = "100";
        } else if (cVal === "Q00") {
            inputThptScore.placeholder = "Ví dụ: 105.0 (Thang 150 HSA)";
            inputThptScore.max = "150";
        } else {
            inputThptScore.placeholder = "Ví dụ: 24.5";
            inputThptScore.max = "30";
        }
        calculateScoreFromSubjects();
        handleThptAnalysis();
    });

    [selectChanceLevel, filterThptYear, selectThptRegion].forEach(el => {
        if (el) {
            el.addEventListener("change", () => {
                handleThptAnalysis();
            });
        }
    });

    if (selectThptUniversity) {
        selectThptUniversity.addEventListener("change", () => {
            if (selectOtherUniversity) selectOtherUniversity.value = selectThptUniversity.value;
            handleThptAnalysis();
        });
    }

    filterThptKeyword.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleThptAnalysis();
        }, 250);
    });

    // Lắng nghe khi nhập điểm từng môn
    Object.values(subInputs).forEach(input => {
        if (!input) return;
        input.addEventListener("input", () => {
            calculateScoreFromSubjects();
        });
    });

    function calculateScoreFromSubjects() {
        const combo = selectThptCombo.value.trim();
        if (!combo || !COMBO_SUBJECTS[combo]) return;

        const neededSubjects = COMBO_SUBJECTS[combo];
        let sum = 0;
        let hasValue = false;

        neededSubjects.forEach(sub => {
            const inp = subInputs[sub];
            if (inp && inp.value.trim() !== "") {
                const val = parseFloat(inp.value);
                if (!isNaN(val)) {
                    sum += val;
                    hasValue = true;
                }
            }
        });

        if (hasValue) {
            inputThptScore.value = sum.toFixed(2);
            handleThptAnalysis();
        }
    }

    quickScoreButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const score = btn.getAttribute("data-score");
            inputThptScore.value = score;
            handleThptAnalysis();
        });
    });

    btnClearThpt.addEventListener("click", () => {
        inputThptScore.value = "";
        selectThptCombo.value = "A00";
        if (selectThptRegion) selectThptRegion.value = "0";
        if (selectThptUniversity) selectThptUniversity.value = "";
        if (selectOtherUniversity) selectOtherUniversity.value = "";
        selectChanceLevel.value = "all";
        filterThptKeyword.value = "";
        filterThptYear.value = "";
        Object.values(subInputs).forEach(inp => { if (inp) inp.value = ""; });
        handleThptAnalysis();
    });

    btnThptExpandAll.addEventListener("click", () => {
        thptSchoolsContainer.querySelectorAll(".school-majors-body").forEach(el => el.classList.remove("hidden"));
        thptSchoolsContainer.querySelectorAll(".school-chevron").forEach(el => el.classList.add("rotate-180"));
    });

    btnThptCollapseAll.addEventListener("click", () => {
        thptSchoolsContainer.querySelectorAll(".school-majors-body").forEach(el => el.classList.add("hidden"));
        thptSchoolsContainer.querySelectorAll(".school-chevron").forEach(el => el.classList.remove("rotate-180"));
    });

    // 4. Tab 2: Các phương thức khác Event Listeners
    [selectOtherMethodType, inputOtherScore].forEach(el => {
        if (el) {
            el.addEventListener("input", () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    handleOthersAnalysis();
                }, 250);
            });
        }
    });

    [selectOtherMethodType, filterOtherYear].forEach(el => {
        if (el) {
            el.addEventListener("change", () => {
                handleOthersAnalysis();
            });
        }
    });

    if (selectOtherUniversity) {
        selectOtherUniversity.addEventListener("change", () => {
            if (selectThptUniversity) selectThptUniversity.value = selectOtherUniversity.value;
            handleOthersAnalysis();
        });
    }

    if (filterOtherKeyword) {
        filterOtherKeyword.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                handleOthersAnalysis();
            }, 250);
        });
    }

    if (btnClearOthers) {
        btnClearOthers.addEventListener("click", () => {
            if (selectOtherMethodType) selectOtherMethodType.value = "";
            if (inputOtherScore) inputOtherScore.value = "";
            if (selectOtherUniversity) selectOtherUniversity.value = "";
            if (selectThptUniversity) selectThptUniversity.value = "";
            if (filterOtherKeyword) filterOtherKeyword.value = "";
            if (filterOtherYear) filterOtherYear.value = "";
            handleOthersAnalysis();
        });
    }

    // 5. Tab 3: Table Mode Event Listeners
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
    // XỬ LÝ TAB 1: PHÂN TÍCH ĐIỂM THI THPT THEO TỔ HỢP MÔN
    // =========================================================================

    function calculateEffectivePriority(rawScore, basePriority) {
        if (!basePriority || basePriority <= 0) return 0;
        if (rawScore < 22.5) {
            return basePriority;
        }
        // Quy chế Bộ GD&ĐT từ 2023: Khi tổng điểm >= 22.5, điểm ưu tiên giảm theo công thức:
        // Điểm ưu tiên = [(30 - Điểm đạt được) / 7.5] * Mức điểm ưu tiên
        const effective = ((30 - rawScore) / 7.5) * basePriority;
        return Math.max(0, Math.round(effective * 100) / 100);
    }

    async function handleThptAnalysis() {
        const val = inputThptScore.value.trim();
        const userRawScore = parseFloat(val);

        if (isNaN(userRawScore) || userRawScore <= 0) {
            promptThptEmpty.classList.remove("hidden");
            thptSchoolsContainer.innerHTML = "";
            thptSummaryText.textContent = "Vui lòng nhập điểm hoặc chọn mức điểm mẫu để xem danh sách trường.";
            return;
        }

        // Tính điểm ưu tiên khu vực theo Quy chế tuyển sinh ĐH của Bộ GD&ĐT
        const basePriority = selectThptRegion ? (parseFloat(selectThptRegion.value) || 0) : 0;
        const effectivePriority = calculateEffectivePriority(userRawScore, basePriority);
        const admissionScore = Math.round((userRawScore + effectivePriority) * 100) / 100;

        promptThptEmpty.classList.add("hidden");
        thptSummaryText.textContent = `Đang phân tích cơ hội trúng tuyển điểm ${admissionScore.toFixed(2)}...`;

        await loadStaticDataIfNeeded();
        if (!staticScoresData) {
            thptSummaryText.textContent = "Không thể tải dữ liệu điểm.";
            return;
        }

        const selectedCombo = selectThptCombo.value.trim();
        const selectedUniCode = selectThptUniversity ? selectThptUniversity.value.trim() : "";
        const chanceLevel = selectChanceLevel.value;
        const targetYear = filterThptYear.value ? parseInt(filterThptYear.value) : null;
        const kw = filterThptKeyword.value.trim();
        const kwNorm = removeVietnameseTones(kw);

        const schoolsMap = new Map();
        let totalEligibleMajors = 0;

        staticScoresData.forEach(item => {
            // Lọc theo trường đại học được chọn (nếu có)
            if (selectedUniCode && item.university_code !== selectedUniCode) return;

            // Lọc theo năm nếu chọn
            if (targetYear && item.year !== targetYear) return;

            // Lọc theo từ khóa ngành/trường
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

            // Lọc phương thức theo tổ hợp (THPT chuẩn, hoặc K00 ĐGTD, hoặc Q00 ĐGNL)
            (item.methods || []).forEach(m => {
                const mName = m.method || "";
                const sGrp = m.subject_group || "";

                let matchesMethod = false;
                if (selectedCombo === "K00") {
                    matchesMethod = mName.includes("TSA") || mName.includes("tư duy") || sGrp.includes("K00");
                } else if (selectedCombo === "Q00") {
                    matchesMethod = mName.includes("HSA") || mName.includes("Hà Nội") || sGrp.includes("Q00");
                } else {
                    matchesMethod = mName.includes("THPT") || mName.includes("100") || 
                                   (m.cutoff_score !== null && m.cutoff_score <= 30.5 && m.cutoff_score >= 10.0 &&
                                    !mName.includes("TSA") && !mName.includes("ĐGTD") && !mName.includes("HSA") && !mName.includes("V-ACT") && !mName.includes("quốc tế"));
                }

                if (!matchesMethod) return;

                // Lọc theo tổ hợp môn được chọn (ví dụ: A00, D01, K00, Q00...)
                if (selectedCombo) {
                    if (selectedCombo === "K00") {
                        if (!sGrp.includes("K00") && !mName.includes("TSA")) return;
                    } else if (selectedCombo === "Q00") {
                        if (!sGrp.includes("Q00") && !mName.includes("HSA")) return;
                    } else {
                        if (!sGrp.includes(selectedCombo)) return;
                    }
                }

                const cutoff = m.cutoff_score;
                if (cutoff === null || cutoff === undefined || cutoff <= 0) return;

                // So sánh Điểm xét tuyển (đã cộng điểm ưu tiên vùng) với Điểm chuẩn
                const diff = Math.round((admissionScore - cutoff) * 100) / 100;

                let isEligible = false;
                let chanceType = "";
                let chanceLabel = "";

                if (diff >= 1.0) {
                    chanceType = "safe";
                    chanceLabel = `🟢 Đỗ rất an toàn (+${diff.toFixed(2)}đ)`;
                } else if (diff >= 0.0) {
                    chanceType = "good";
                    chanceLabel = `🔵 Cơ hội tốt (+${diff.toFixed(2)}đ)`;
                } else if (diff >= -1.0) {
                    chanceType = "stretch";
                    chanceLabel = `🟡 Thử thách (${diff.toFixed(2)}đ)`;
                }

                if (chanceLevel === "all") isEligible = diff >= -0.25;
                else if (chanceLevel === "safe") isEligible = diff >= 1.0;
                else if (chanceLevel === "good") isEligible = diff >= 0.0;
                else if (chanceLevel === "stretch") isEligible = diff >= -1.0 && diff < 0.0;

                if (!isEligible) return;

                const uniCode = item.university_code;
                if (!schoolsMap.has(uniCode)) {
                    schoolsMap.set(uniCode, {
                        code: uniCode,
                        name: item.university_name || uniCode,
                        majors: []
                    });
                }

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
                        user_score: userRawScore,
                        effective_priority: effectivePriority,
                        admission_score: admissionScore,
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

        const schoolsList = Array.from(schoolsMap.values());
        schoolsList.sort((a, b) => b.majors.length - a.majors.length);
        schoolsList.forEach(s => s.majors.sort((a, b) => b.cutoff_score - a.cutoff_score));

        const comboText = selectedCombo ? `tổ hợp ${selectedCombo}` : "tất cả tổ hợp";
        let scoreBreakdown = `Điểm thi: <b class="text-blue-900">${userRawScore.toFixed(2)}</b>`;
        if (effectivePriority > 0) {
            scoreBreakdown += ` + Điểm vùng: <b class="text-emerald-700">+${effectivePriority.toFixed(2)}đ</b> ➔ Điểm xét tuyển: <b class="text-blue-900 text-sm sm:text-base">${admissionScore.toFixed(2)}</b>`;
        } else {
            scoreBreakdown += ` ➔ Điểm xét tuyển: <b class="text-blue-900 text-sm sm:text-base">${admissionScore.toFixed(2)}</b>`;
        }

        if (schoolsList.length === 0) {
            thptSchoolsContainer.innerHTML = `
                <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                    <p class="text-slate-700 font-bold text-base">Không tìm thấy trường nào phù hợp</p>
                    <p class="text-slate-400 text-xs mt-1">Thử chọn trường khác, tổ hợp môn khác hoặc nới rộng mức độ cơ hội.</p>
                </div>
            `;
            thptSummaryText.innerHTML = `Chưa tìm thấy trường nào với mức ${scoreBreakdown} (${comboText}).`;
            return;
        }

        thptSummaryText.innerHTML = `🎉 Tìm thấy <span class="font-extrabold text-blue-700">${schoolsList.length}</span> trường với <span class="font-extrabold text-emerald-700">${totalEligibleMajors}</span> ngành có cơ hội trúng tuyển (${scoreBreakdown})!`;

        renderSchoolCards(schoolsList, userRawScore, thptSchoolsContainer, effectivePriority, admissionScore);
    }

    // =========================================================================
    // XỬ LÝ TAB 2: CÁC PHƯƠNG THỨC XÉT TUYỂN KHÁC (TÁCH RIÊNG 100%)
    // =========================================================================

    async function handleOthersAnalysis() {
        await loadStaticDataIfNeeded();
        if (!staticScoresData) return;

        const methodType = selectOtherMethodType ? selectOtherMethodType.value.trim() : "";
        const scoreVal = inputOtherScore ? inputOtherScore.value.trim() : "";
        const userScore = scoreVal ? parseFloat(scoreVal) : null;
        const selectedUniCode = selectOtherUniversity ? selectOtherUniversity.value.trim() : "";
        const targetYear = filterOtherYear && filterOtherYear.value ? parseInt(filterOtherYear.value) : null;
        const kw = filterOtherKeyword ? filterOtherKeyword.value.trim() : "";
        const kwNorm = removeVietnameseTones(kw);

        const schoolsMap = new Map();
        let totalCount = 0;

        staticScoresData.forEach(item => {
            // Lọc theo trường đại học được chọn (nếu có)
            if (selectedUniCode && item.university_code !== selectedUniCode) return;

            // Lọc theo năm nếu chọn
            if (targetYear && item.year !== targetYear) return;

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

            (item.methods || []).forEach(m => {
                const mName = m.method || "";

                // Bỏ qua phương thức THPT chuẩn
                const isThpt = mName.includes("THPT") || mName.includes("100");
                if (isThpt) return;

                // Lọc theo loại phương thức riêng được chọn
                if (methodType === "tsa" && !mName.includes("TSA") && !mName.includes("ĐGTD") && !(m.subject_group || "").includes("K00")) return;
                if (methodType === "hsa" && !mName.includes("HSA") && !(m.subject_group || "").includes("Q00")) return;
                if (methodType === "vact" && !mName.includes("V-ACT") && !mName.includes("ĐGNL ĐHQG-HCM")) return;
                if (methodType === "vsat" && !mName.includes("V-SAT") && !mName.includes("VSAT") && !mName.includes("đầu vào")) return;
                if (methodType === "spt" && !mName.includes("SPT") && !mName.includes("Sư phạm")) return;
                if (methodType === "bca" && !mName.includes("Công An") && !mName.includes("BCA") && !mName.includes("QDA")) return;
                if (methodType === "hocba" && !mName.includes("học bạ") && !mName.includes("Học bạ")) return;
                if (methodType === "ccqt" && !mName.includes("quốc tế") && !mName.includes("CCQT") && !mName.includes("SAT") && !mName.includes("IELTS")) return;
                if (methodType === "kethop" && !mName.includes("kết hợp") && !mName.includes("PT2") && !mName.includes("PT3") && !mName.includes("PT4")) return;
                if (methodType === "tuyenthang" && !mName.includes("Tuyển thẳng") && !mName.includes("ƯTXT")) return;

                const cutoff = m.cutoff_score;
                if (userScore !== null && cutoff !== null && cutoff > 0) {
                    if (cutoff > userScore + 0.5) return; // Nếu điểm chuẩn cao hơn điểm đạt được thì không hiện
                }

                const uniCode = item.university_code;
                if (!schoolsMap.has(uniCode)) {
                    schoolsMap.set(uniCode, {
                        code: uniCode,
                        name: item.university_name || uniCode,
                        majors: []
                    });
                }

                schoolsMap.get(uniCode).majors.push({
                    major_name: item.major_name,
                    major_code: item.major_code,
                    year: item.year,
                    method: m.method,
                    subject_group: m.subject_group,
                    cutoff_score: cutoff,
                    cutoff_score_text: m.cutoff_score_text,
                    user_score: userScore,
                    quota: item.quota,
                    notes: m.notes
                });
                totalCount++;
            });
        });

        const schoolsList = Array.from(schoolsMap.values());
        schoolsList.sort((a, b) => b.majors.length - a.majors.length);

        if (schoolsList.length === 0) {
            othersSchoolsContainer.innerHTML = `
                <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                    <p class="text-slate-700 font-bold text-base">Không tìm thấy trường nào phù hợp</p>
                    <p class="text-slate-400 text-xs mt-1">Thử chọn trường khác, phương thức khác hoặc xóa từ khóa tìm kiếm.</p>
                </div>
            `;
            othersSummaryText.textContent = "Không có kết quả phù hợp với các tiêu chí đã chọn.";
            return;
        }

        const uniInfo = selectedUniCode ? ` (trường ${selectedUniCode})` : "";
        othersSummaryText.innerHTML = `Tìm thấy <span class="font-extrabold text-purple-700">${schoolsList.length}</span> trường đại học${uniInfo} với <span class="font-extrabold text-blue-700">${totalCount}</span> ngành xét tuyển theo các phương thức riêng!`;

        renderOtherSchoolCards(schoolsList, othersSchoolsContainer);
    }

    /**
     * RENDER CARD CHO TAB 1 (THPT)
     */
    function renderSchoolCards(schoolsList, userScore, container, effectivePriority = 0, admissionScore = 0) {
        let html = "";

        schoolsList.forEach((school, index) => {
            const majorsCount = school.majors.length;
            const isFirstFew = index < 6;

            let rowsHtml = "";
            school.majors.forEach(m => {
                let badgeClass = "chance-badge-good";
                if (m.chanceType === "safe") badgeClass = "chance-badge-safe";
                else if (m.chanceType === "stretch") badgeClass = "chance-badge-stretch";

                let subjHtml = "-";
                if (m.subject_group) {
                    const parts = m.subject_group.split(";").map(s => s.trim()).filter(Boolean);
                    if (parts.length > 3) {
                        subjHtml = `<span class="subject-pill">${parts[0]}</span> <span class="text-[10px] text-slate-400 font-medium">+${parts.length - 1}</span>`;
                    } else {
                        subjHtml = parts.map(p => `<span class="subject-pill">${p}</span>`).join(" ");
                    }
                }

                const displayAdmScore = (m.admission_score !== undefined ? m.admission_score : userScore).toFixed(2);
                const priorityBadge = m.effective_priority > 0 
                    ? `<span class="block text-[10px] text-emerald-600 font-semibold" title="Điểm thi: ${m.user_score.toFixed(2)} + Ưu tiên vùng: ${m.effective_priority.toFixed(2)}đ">(+${m.effective_priority.toFixed(2)}đ vùng)</span>`
                    : `<span class="block text-[10px] text-slate-400 font-normal">Điểm thi gốc</span>`;

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
                        <span class="font-bold text-blue-700 text-sm">${displayAdmScore}</span>
                        ${priorityBadge}
                    </td>
                    <td class="py-2.5 px-4 text-right">
                        <span class="${badgeClass}">${m.chanceLabel}</span>
                    </td>
                </tr>
                `;
            });

            html += `
            <div class="uni-card bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
                <div class="school-card-header px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/80 hover:bg-blue-50/50 border-b border-slate-100 select-none">
                    <div class="flex items-center space-x-3.5 flex-1 min-w-0">
                        <span class="w-12 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white font-black text-sm flex items-center justify-center tracking-tight shadow-xs">
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
                        <button class="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-transform">
                            <i class="fa-solid fa-chevron-down school-chevron transition-transform ${isFirstFew ? 'rotate-180' : ''}"></i>
                        </button>
                    </div>
                </div>

                <div class="school-majors-body ${isFirstFew ? '' : 'hidden'} overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="bg-slate-100/50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
                            <tr>
                                <th class="py-2 px-4">Tên Ngành Xét Tuyển</th>
                                <th class="py-2 px-3 text-center w-28">Khối Thi</th>
                                <th class="py-2 px-3 text-center w-24">Điểm Chuẩn</th>
                                <th class="py-2 px-3 text-center w-32">Điểm Xét Tuyển</th>
                                <th class="py-2 px-4 text-right w-44">Đánh Giá Cơ Hội</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${rowsHtml}
                        </tbody>
                    </table>
                    <div class="px-5 py-2.5 bg-purple-50/60 border-t border-purple-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span class="text-purple-800 font-medium">Trường này còn có các phương thức tuyển sinh riêng:</span>
                        <button type="button" class="btn-goto-other-methods px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer" data-code="${escapeHtml(school.code)}">
                            <i class="fa-solid fa-brain"></i>
                            <span>Xem điểm ĐGNL, ĐGTD, Học bạ... của trường ${escapeHtml(school.code)}</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
        bindCardToggleEvents(container);
    }

    /**
     * RENDER CARD CHO TAB 2 (CÁC PHƯƠNG THỨC KHÁC)
     */
    function renderOtherSchoolCards(schoolsList, container) {
        let html = "";

        schoolsList.forEach((school, index) => {
            const majorsCount = school.majors.length;
            const isFirstFew = index < 6;

            let rowsHtml = "";
            school.majors.forEach(m => {
                const scoreVal = m.cutoff_score !== null ? m.cutoff_score : (m.cutoff_score_text || "-");
                let subjHtml = m.subject_group ? `<span class="subject-pill">${escapeHtml(m.subject_group)}</span>` : "-";

                rowsHtml += `
                <tr class="hover:bg-purple-50/40 transition-colors border-b border-slate-100 last:border-b-0 text-xs">
                    <td class="py-2.5 px-4 font-semibold text-slate-800">
                        <div class="text-sm font-bold text-slate-900">${escapeHtml(m.major_name)}</div>
                        ${m.major_code ? `<span class="text-[11px] font-mono text-slate-400">Mã: ${escapeHtml(m.major_code)}</span>` : ""}
                        ${m.notes ? `<span class="text-[10.5px] text-slate-400 italic block mt-0.5">${escapeHtml(m.notes)}</span>` : ""}
                    </td>
                    <td class="py-2.5 px-3">
                        <span class="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                            ${escapeHtml(m.method)}
                        </span>
                    </td>
                    <td class="py-2.5 px-3 text-center">${subjHtml}</td>
                    <td class="py-2.5 px-4 text-right">
                        <span class="inline-block font-black text-slate-900 text-sm bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            ${scoreVal}
                        </span>
                        <span class="block text-[10px] text-slate-400 mt-0.5">Năm ${m.year}</span>
                    </td>
                </tr>
                `;
            });

            html += `
            <div class="uni-card bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
                <div class="school-card-header px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/80 hover:bg-purple-50/50 border-b border-slate-100 select-none">
                    <div class="flex items-center space-x-3.5 flex-1 min-w-0">
                        <span class="w-12 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-700 text-white font-black text-sm flex items-center justify-center tracking-tight shadow-xs">
                            ${escapeHtml(school.code)}
                        </span>
                        <div class="truncate">
                            <h3 class="font-extrabold text-slate-900 text-base truncate leading-snug" title="${escapeHtml(school.name)}">
                                ${escapeHtml(school.name)}
                            </h3>
                            <p class="text-xs text-slate-500 mt-0.5">Mã trường: <b class="text-purple-700 font-bold">${escapeHtml(school.code)}</b></p>
                        </div>
                    </div>

                    <div class="flex items-center space-x-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                            ${majorsCount} ngành tuyển sinh
                        </span>
                        <button class="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-purple-600 flex items-center justify-center transition-transform">
                            <i class="fa-solid fa-chevron-down school-chevron transition-transform ${isFirstFew ? 'rotate-180' : ''}"></i>
                        </button>
                    </div>
                </div>

                <div class="school-majors-body ${isFirstFew ? '' : 'hidden'} overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="bg-slate-100/50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
                            <tr>
                                <th class="py-2 px-4">Tên Ngành Xét Tuyển</th>
                                <th class="py-2 px-3">Phương Thức Xét Tuyển</th>
                                <th class="py-2 px-3 text-center w-28">Tổ Hợp / Điều Kiện</th>
                                <th class="py-2 px-4 text-right w-32">Điểm Chuẩn</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${rowsHtml}
                        </tbody>
                    </table>
                    <div class="px-5 py-2.5 bg-blue-50/60 border-t border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span class="text-blue-800 font-medium">Xem kết quả xét tuyển theo điểm thi THPT:</span>
                        <button type="button" class="btn-goto-thpt-methods px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer" data-code="${escapeHtml(school.code)}">
                            <i class="fa-solid fa-award"></i>
                            <span>Xem điểm thi tốt nghiệp THPT của trường ${escapeHtml(school.code)}</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
        bindCardToggleEvents(container);
    }

    function bindCardToggleEvents(container) {
        container.querySelectorAll(".school-card-header").forEach(header => {
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

        container.querySelectorAll(".btn-goto-other-methods").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const code = btn.getAttribute("data-code");
                if (selectOtherUniversity) selectOtherUniversity.value = code;
                if (selectThptUniversity) selectThptUniversity.value = code;
                setActiveTab("others");
            });
        });

        container.querySelectorAll(".btn-goto-thpt-methods").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const code = btn.getAttribute("data-code");
                if (selectThptUniversity) selectThptUniversity.value = code;
                if (selectOtherUniversity) selectOtherUniversity.value = code;
                setActiveTab("thpt");
            });
        });
    }

    // =========================================================================
    // XỬ LÝ TAB 3: BẢNG TRA CỨU TOÀN BỘ (RAW TABLE VIEW)
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

    async function populateUniversitiesDropdown() {
        try {
            let list = [];
            const url = isStaticMode ? `${STATIC_BASE}/universities.json` : "/api/universities";
            const res = await fetch(url);
            if (res.ok) {
                list = await res.json();
            } else if (staticScoresData) {
                const map = new Map();
                staticScoresData.forEach(item => {
                    if (item.university_code && !map.has(item.university_code)) {
                        map.set(item.university_code, item.university_name || item.university_code);
                    }
                });
                list = Array.from(map.entries()).map(([code, name]) => ({ code, name }));
            }

            // Sắp xếp danh sách trường theo bảng chữ cái tiếng Việt
            list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));

            let optionsHtml = '<option value="">-- Tất cả các trường đại học (~300 trường) --</option>';
            list.forEach(u => {
                optionsHtml += `<option value="${escapeHtml(u.code)}">${escapeHtml(u.code)} - ${escapeHtml(u.name)}</option>`;
            });

            if (selectThptUniversity) selectThptUniversity.innerHTML = optionsHtml;
            if (selectOtherUniversity) selectOtherUniversity.innerHTML = optionsHtml;
        } catch (err) {
            console.warn("Lỗi tải danh sách trường:", err);
            if (staticScoresData) {
                const map = new Map();
                staticScoresData.forEach(item => {
                    if (item.university_code && !map.has(item.university_code)) {
                        map.set(item.university_code, item.university_name || item.university_code);
                    }
                });
                const fallbackList = Array.from(map.entries()).map(([code, name]) => ({ code, name }));
                fallbackList.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
                let optionsHtml = '<option value="">-- Tất cả các trường đại học (~300 trường) --</option>';
                fallbackList.forEach(u => {
                    optionsHtml += `<option value="${escapeHtml(u.code)}">${escapeHtml(u.code)} - ${escapeHtml(u.name)}</option>`;
                });
                if (selectThptUniversity) selectThptUniversity.innerHTML = optionsHtml;
                if (selectOtherUniversity) selectOtherUniversity.innerHTML = optionsHtml;
            }
        }
    }

    async function fetchScores() {
        await loadStaticDataIfNeeded();
        if (!staticScoresData) return;

        const [sort_by, sort_order] = (sortBySelect ? sortBySelect.value : "cutoff_score-DESC").split("-");

        let items = [...staticScoresData];

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
