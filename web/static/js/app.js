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
    const tabNavCareer = document.getElementById("tab-nav-career");
    const tabNavTable = document.getElementById("tab-nav-table");

    const sectionThpt = document.getElementById("section-thpt");
    const sectionOthers = document.getElementById("section-others");
    const sectionCareer = document.getElementById("section-career");
    const sectionTable = document.getElementById("section-table");

    // DOM Elements - Tab 3: AI Career Matcher (RIASEC)
    const careerStepIndicator = document.getElementById("career-step-indicator");
    const careerProgressBar = document.getElementById("career-progress-bar");
    const careerQuestionView = document.getElementById("career-question-view");
    const btnCareerPrev = document.getElementById("btn-career-prev");
    const btnCareerNext = document.getElementById("btn-career-next");
    const careerNextText = document.getElementById("career-next-text");
    const careerNextIcon = document.getElementById("career-next-icon");
    const btnCareerReset = document.getElementById("btn-career-reset");
    const careerQuizCard = document.getElementById("career-quiz-card");
    const careerResultsCard = document.getElementById("career-results-card");

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
        [tabNavThpt, tabNavOthers, tabNavCareer, tabNavTable].forEach(b => {
            if (b) b.className = "flex-1 min-w-[200px] py-2.5 px-4 rounded-xl font-bold text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-2 transition-all";
        });
        [sectionThpt, sectionOthers, sectionCareer, sectionTable].forEach(s => {
            if (s) s.classList.add("hidden");
        });

        if (tab === "thpt") {
            if (tabNavThpt) tabNavThpt.className = "flex-1 min-w-[200px] py-2.5 px-4 rounded-xl font-extrabold text-sm bg-blue-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all";
            if (sectionThpt) sectionThpt.classList.remove("hidden");
            if (selectOtherUniversity && selectThptUniversity && selectOtherUniversity.value && !selectThptUniversity.value) {
                selectThptUniversity.value = selectOtherUniversity.value;
            }
            handleThptAnalysis();
        } else if (tab === "others") {
            if (tabNavOthers) tabNavOthers.className = "flex-1 min-w-[200px] py-2.5 px-4 rounded-xl font-extrabold text-sm bg-purple-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all";
            if (sectionOthers) sectionOthers.classList.remove("hidden");
            if (selectThptUniversity && selectOtherUniversity && selectThptUniversity.value && !selectOtherUniversity.value) {
                selectOtherUniversity.value = selectThptUniversity.value;
            }
            handleOthersAnalysis();
        } else if (tab === "career") {
            if (tabNavCareer) tabNavCareer.className = "flex-1 min-w-[220px] py-2.5 px-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all";
            if (sectionCareer) sectionCareer.classList.remove("hidden");
            initCareerQuiz();
        } else if (tab === "table") {
            if (tabNavTable) tabNavTable.className = "sm:w-auto py-2.5 px-4 rounded-xl font-extrabold text-sm bg-emerald-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all";
            if (sectionTable) sectionTable.classList.remove("hidden");
            fetchScores();
        }
    }

    if (tabNavThpt) tabNavThpt.addEventListener("click", () => setActiveTab("thpt"));
    if (tabNavOthers) tabNavOthers.addEventListener("click", () => setActiveTab("others"));
    if (tabNavCareer) tabNavCareer.addEventListener("click", () => setActiveTab("career"));
    if (tabNavTable) tabNavTable.addEventListener("click", () => setActiveTab("table"));

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

    // =========================================================================
    // 6. PHẦN 3: AI HƯỚNG NGHIỆP & GỢI Ý NGÀNH HỌC (RIASEC / HOLLAND)
    // =========================================================================

    const RIASEC_QUESTIONS = [
        {
            id: 1,
            title: "Khi được tự do lựa chọn một hoạt động, bạn thích làm gì nhất?",
            subtitle: "Khám phá xu hướng hành động và phong cách thực hiện công việc tự nhiên của bạn.",
            type: "single",
            options: [
                {
                    code: "R",
                    icon: "fa-wrench",
                    color: "amber",
                    title: "Thực hành & Kỹ thuật",
                    desc: "Thích sửa chữa đồ đạc, lắp ráp máy móc, thao tác với linh kiện điện tử, công cụ phần cứng hoặc vận hành thiết bị cơ khí."
                },
                {
                    code: "I",
                    icon: "fa-microchip",
                    color: "blue",
                    title: "Nghiên cứu & Logic",
                    desc: "Thích lập trình, viết code, phân tích dữ liệu, tìm hiểu thuật toán, đọc tài liệu khoa học và tìm ra nguyên lý hoạt động của mọi thứ."
                },
                {
                    code: "A",
                    icon: "fa-palette",
                    color: "rose",
                    title: "Nghệ thuật & Sáng tạo",
                    desc: "Thích thiết kế đồ họa, vẽ, làm video, viết lách, sáng tạo nội dung truyền thông, trang trí không gian hoặc thể hiện bản sắc cá nhân."
                },
                {
                    code: "S",
                    icon: "fa-hand-holding-heart",
                    color: "emerald",
                    title: "Xã hội & Giúp đỡ",
                    desc: "Thích giao tiếp, lắng nghe, tư vấn tâm lý, dạy học, chăm sóc sức khỏe, kết nối mọi người và tham gia hoạt động vì cộng đồng."
                },
                {
                    code: "E",
                    icon: "fa-chart-line",
                    color: "indigo",
                    title: "Kinh doanh & Lãnh đạo",
                    desc: "Thích khởi nghiệp, đàm phán, thuyết phục, bán hàng, quản lý đội nhóm, đầu tư tài chính và nắm bắt cơ hội thị trường."
                },
                {
                    code: "C",
                    icon: "fa-clipboard-check",
                    color: "slate",
                    title: "Quy củ & Nghiệp vụ",
                    desc: "Thích làm việc với số liệu bảng tính, lập kế hoạch chi tiết, kiểm soát quy trình, sắp xếp hồ sơ chuẩn xác và công việc ổn định."
                }
            ]
        },
        {
            id: 2,
            title: "Những môn học nào bạn cảm thấy tự tin và có hứng thú nhất tại THPT?",
            subtitle: "Chọn từ 1 đến 3 nhóm môn học thế mạnh nhất của bạn.",
            type: "multi",
            maxSelect: 3,
            options: [
                { code: "R", icon: "fa-gears", color: "amber", title: "Vật lý & Công nghệ", desc: "Định luật vật lý, điện từ học, quang học, máy móc cơ khí" },
                { code: "I", icon: "fa-laptop-code", color: "blue", title: "Toán học & Tin học", desc: "Tư duy đại số, hình học không gian, lập trình thuật toán" },
                { code: "I", icon: "fa-dna", color: "cyan", title: "Hóa học & Sinh học", desc: "Cơ chế sinh học, phản ứng hóa học, y dược và sự sống" },
                { code: "A", icon: "fa-feather", color: "rose", title: "Ngữ văn & Mỹ thuật", desc: "Ngôn từ, cảm thụ tác phẩm, sáng tạo câu chuyện, thẩm mỹ" },
                { code: "S", icon: "fa-earth-americas", color: "emerald", title: "Ngoại ngữ & Lịch sử/Địa lý", desc: "Tiếng Anh, văn hóa quốc tế, xã hội và nhân loại" },
                { code: "E", icon: "fa-scale-balanced", color: "indigo", title: "Kinh tế & Pháp luật / GDCD", desc: "Quy luật thị trường, pháp luật, tài chính, tranh biện" }
            ]
        },
        {
            id: 3,
            title: "Môi trường làm việc lý tưởng trong tương lai mà bạn khao khát?",
            subtitle: "Không gian làm việc quyết định năng lượng và sự hứng khởi mỗi ngày của bạn.",
            type: "single",
            options: [
                {
                    code: "R",
                    icon: "fa-industry",
                    color: "amber",
                    title: "Xưởng công nghệ & Hiện trường",
                    desc: "Nhà máy thông minh, phân xưởng kỹ thuật, công trường xây dựng hiện đại, phòng kỹ thuật ô tô, hàng không."
                },
                {
                    code: "I",
                    icon: "fa-flask-vial",
                    color: "blue",
                    title: "Phòng Lab & Viện Công nghệ",
                    desc: "Viện nghiên cứu, phòng thí nghiệm hiện đại, công ty phần mềm công nghệ cao, trung tâm dữ liệu AI."
                },
                {
                    code: "A",
                    icon: "fa-camera-retro",
                    color: "rose",
                    title: "Studio Sáng tạo & Tự do",
                    desc: "Studio thiết kế, công ty truyền thông sáng tạo, tòa soạn, agency quảng cáo hoặc làm việc linh hoạt (Freelance)."
                },
                {
                    code: "S",
                    icon: "fa-school",
                    color: "emerald",
                    title: "Trường học, Bệnh viện & Cộng đồng",
                    desc: "Giảng đường đại học, bệnh viện, cơ sở y tế, tổ chức phi chính phủ (NGO) tương tác gần gũi với con người."
                },
                {
                    code: "E",
                    icon: "fa-building",
                    color: "indigo",
                    title: "Tòa cao ốc Tập đoàn & Tài chính",
                    desc: "Văn phòng cao ốc hiện đại tại các trung tâm tài chính, sàn giao dịch, môi trường kinh doanh quốc tế sôi động."
                },
                {
                    code: "C",
                    icon: "fa-landmark",
                    color: "slate",
                    title: "Cơ quan Quản lý, Ngân hàng & Kiểm toán",
                    desc: "Ngân hàng lớn, công ty kiểm toán Big 4, cơ quan nhà nước với quy chuẩn bảo mật và hệ thống rõ ràng."
                }
            ]
        },
        {
            id: 4,
            title: "Khi gặp một vấn đề phức tạp hoặc thử thách khó, phản xạ đầu tiên của bạn là gì?",
            subtitle: "Phương thức tư duy và phong cách giải quyết vấn đề phản ánh năng lực cốt lõi.",
            type: "single",
            options: [
                {
                    code: "R",
                    icon: "fa-screwdriver-wrench",
                    color: "amber",
                    title: "Hành động thực tế & Khắc phục ngay",
                    desc: "Trực tiếp kiểm tra từng bộ phận, thao tác thử nghiệm bằng tay để tìm điểm hỏng hóc và sửa chữa ngay."
                },
                {
                    code: "I",
                    icon: "fa-magnifying-glass-chart",
                    color: "blue",
                    title: "Phân tích nguyên nhân & Dữ liệu",
                    desc: "Truy tìm nguyên nhân gốc rễ, tra cứu tài liệu học thuật, xây dựng mô hình logic và chứng minh bằng số liệu."
                },
                {
                    code: "A",
                    icon: "fa-wand-magic",
                    color: "rose",
                    title: "Tìm góc nhìn mới & Đột phá",
                    desc: "Suy nghĩ 'ngoài chiếc hộp' (out-of-the-box), tìm cách tiếp cận mới lạ chưa ai từng thử để giải bài toán."
                },
                {
                    code: "S",
                    icon: "fa-comments",
                    color: "emerald",
                    title: "Thảo luận & Lắng nghe đồng đội",
                    desc: "Tập hợp mọi người, lắng nghe các góc nhìn đa chiều, tạo sự đồng thuận và cùng nhau tìm hướng giải quyết."
                },
                {
                    code: "E",
                    icon: "fa-bolt",
                    color: "indigo",
                    title: "Quyết đoán & Dẫn dắt hành động",
                    desc: "Nhanh chóng ra quyết định, phân chia nhiệm vụ cho từng người và truyền động lực để toàn đội tiến lên."
                },
                {
                    code: "C",
                    icon: "fa-list-check",
                    color: "slate",
                    title: "Kiểm tra quy trình & Checklist",
                    desc: "Rà soát lại quy trình chuẩn, đối chiếu checklist từng bước để đảm bảo không xảy ra sai sót thêm."
                }
            ]
        },
        {
            id: 5,
            title: "Giá trị nghề nghiệp nào mang lại cho bạn cảm giác tự hào và hạnh phúc nhất?",
            subtitle: "Động lực nội tại giúp bạn kiên trì và phát triển bền vững trong sự nghiệp.",
            type: "single",
            options: [
                {
                    code: "R",
                    icon: "fa-cube",
                    color: "amber",
                    title: "Sản phẩm hữu hình thực tế",
                    desc: "Nhìn thấy công trình, cỗ máy hay sản phẩm vật lý do chính mình chế tạo vận hành trơn tru trong đời sống."
                },
                {
                    code: "I",
                    icon: "fa-atom",
                    color: "blue",
                    title: "Chuyên môn sâu & Đổi mới công nghệ",
                    desc: "Được công nhận là chuyên gia xuất sắc, phát triển giải pháp công nghệ cao giải quyết những bài toán lớn."
                },
                {
                    code: "A",
                    icon: "fa-gem",
                    color: "rose",
                    title: "Tự do sáng tạo & Bản sắc cá nhân",
                    desc: "Tự do thể hiện cá tính riêng, tạo ra những tác phẩm có tính thẩm mỹ và lay động cảm xúc công chúng."
                },
                {
                    code: "S",
                    icon: "fa-heart-circle-check",
                    color: "emerald",
                    title: "Cống hiến & Giúp đỡ con người",
                    desc: "Thấy người khác tiến bộ, khỏe mạnh hơn nhờ sự hỗ trợ của mình, đóng góp tích cực cho xã hội."
                },
                {
                    code: "E",
                    icon: "fa-trophy",
                    color: "indigo",
                    title: "Thành công tài chính & Tầm ảnh hưởng",
                    desc: "Mức thu nhập hấp dẫn, vị thế lãnh đạo, mở rộng quy mô kinh doanh và có sức ảnh hưởng lớn."
                },
                {
                    code: "C",
                    icon: "fa-shield-halved",
                    color: "slate",
                    title: "Sự ổn định, Chuẩn mực & An toàn",
                    desc: "Công việc có lộ trình rõ ràng, ít biến động rủi ro, môi trường minh bạch, chuẩn mực và phúc lợi đảm bảo."
                }
            ]
        },
        {
            id: 6,
            title: "Hồ sơ xét tuyển & Định hướng thực tế của bạn",
            subtitle: "Điền mức điểm và khu vực ưu tiên để AI tự động đối chiếu điểm chuẩn thực tế từ 299 trường đại học.",
            type: "profile"
        }
    ];

    const HOLLAND_ARCHETYPES = {
        "IR": {
            code: "IR",
            title: "Nhà Đổi Mới Công Nghệ & Kỹ Thuật Số",
            subtitle: "Thiên hướng kết hợp giữa tư duy phân tích sâu (Investigative) và khả năng ứng dụng thực tế (Realistic).",
            color: "blue",
            strengths: [
                "Tư duy logic thuật toán nhạy bén, khả năng tự học công nghệ mới nhanh chóng.",
                "Giải quyết bài toán kỹ thuật từ nguyên lý gốc rễ, kiên trì gỡ lỗi (debug).",
                "Chuyển hóa lý thuyết phức tạp thành hệ thống phần mềm, vi mạch hay máy móc hoạt động thực tế."
            ],
            environment: "Các viện nghiên cứu, tập đoàn công nghệ hàng đầu, công ty AI/Phần mềm, phòng Lab vi mạch bán dẫn.",
            majors: [
                {
                    name: "Công nghệ Thông tin & Trí tuệ Nhân tạo (AI)",
                    match: 97,
                    reason: "Đỉnh cao của tư duy logic và công nghệ tương lai, cơ hội việc làm và thu nhập toàn cầu.",
                    careers: "Kỹ sư AI, Lập trình viên Phần mềm, Chuyên gia Dữ liệu lớn (Big Data).",
                    keywords: ["công nghệ thông tin", "trí tuệ nhân tạo", "khoa học máy tính", "khoa học dữ liệu", "kỹ thuật phần mềm", "an toàn thông tin", "mạng máy tính"]
                },
                {
                    name: "Kỹ thuật Vi mạch, Bán dẫn & Điện tử",
                    match: 94,
                    reason: "Ngành mũi nhọn quốc gia với nhu cầu nhân lực chất lượng cao bùng nổ.",
                    careers: "Kỹ sư thiết kế vi mạch, Kỹ sư đóng gói chip, Chuyên gia bán dẫn.",
                    keywords: ["bán dẫn", "vi mạch", "điện tử viễn thông", "kỹ thuật máy tính"]
                },
                {
                    name: "Kỹ thuật Điều khiển, Tự động hóa & Robot",
                    match: 92,
                    reason: "Kết hợp cơ điện tử, cánh tay robot và dây chuyền tự động hóa công nghiệp 4.0.",
                    careers: "Kỹ sư Tự động hóa, Kỹ sư Lập trình Robot, Giám sát hệ thống thông minh.",
                    keywords: ["điều khiển", "tự động hóa", "cơ điện tử", "robot"]
                },
                {
                    name: "Kỹ thuật Cơ khí & Công nghệ Ô tô",
                    match: 88,
                    reason: "Chế tạo xe điện thông minh, máy bay, thiết bị cơ khí chính xác hiện đại.",
                    careers: "Kỹ sư Ô tô điện, Thiết kế cơ khí CAD/CAM, Vận hành bảo trì hàng không.",
                    keywords: ["cơ khí", "ô tô", "chế tạo máy", "kỹ thuật nhiệt", "hàng không"]
                }
            ]
        },
        "RI": {
            code: "RI",
            title: "Kỹ Sư Công Nghệ Ứng Dụng & Cơ Khí Thông Minh",
            subtitle: "Đam mê sáng chế, chế tạo máy móc với nền tảng khoa học vững chắc.",
            color: "amber",
            strengths: [
                "Năng khiếu thao tác máy móc, thiết bị và công cụ kỹ thuật chính xác.",
                "Khả năng đọc hiểu bản vẽ kỹ thuật, mô phỏng 3D và hiện thực hóa ý tưởng.",
                "Sức bền, tính kiên nhẫn và tinh thần thực tiễn cao trong công việc."
            ],
            environment: "Nhà máy sản xuất thông minh, trung tâm R&D cơ điện tử, các dự án công nghệ ô tô và năng lượng.",
            majors: [
                {
                    name: "Công nghệ Kỹ thuật Ô tô & Xe Điện",
                    match: 96,
                    reason: "Lĩnh vực giao thông thông minh đang chuyển mình mạnh mẽ với xe tự hành và pin năng lượng.",
                    careers: "Kỹ sư thiết kế ô tô, Kỹ sư hệ thống pin xe điện, Quản lý sản xuất xe.",
                    keywords: ["ô tô", "cơ khí", "chế tạo máy"]
                },
                {
                    name: "Kỹ thuật Cơ điện tử & Hệ thống Robot",
                    match: 93,
                    reason: "Giao thoa giữa cơ khí chính xác, mạch điện tử và phần mềm nhúng điều khiển.",
                    careers: "Kỹ sư Cơ điện tử, Kỹ sư điều khiển robot công nghiệp, Kỹ sư IoT.",
                    keywords: ["cơ điện tử", "robot", "tự động hóa"]
                },
                {
                    name: "Kỹ thuật Điện - Điện tử & Năng lượng mới",
                    match: 89,
                    reason: "Nền tảng của toàn bộ hạ tầng công nghiệp và xu hướng năng lượng xanh tái tạo.",
                    careers: "Kỹ sư điện lưới thông minh, Chuyên viên năng lượng mặt trời/gió.",
                    keywords: ["điện", "điện tử", "năng lượng", "viễn thông"]
                },
                {
                    name: "Kỹ thuật Xây dựng & Công trình Giao thông",
                    match: 85,
                    reason: "Tạo nên các công trình cao tầng, cầu đường huyết mạch và hạ tầng đô thị hiện đại.",
                    careers: "Kỹ sư kết cấu xây dựng, Chỉ huy trưởng công trình, Giám sát dự án.",
                    keywords: ["xây dựng", "cầu đường", "giao thông", "hạ tầng"]
                }
            ]
        },
        "IE": {
            code: "IE",
            title: "Nhà Chiến Lược Dữ Liệu & Kinh Doanh Số",
            subtitle: "Sự kết hợp hoàn hảo giữa tư duy toán học logic và tầm nhìn kinh doanh nhạy bén.",
            color: "indigo",
            strengths: [
                "Biến số liệu khô khan thành chiến lược kinh doanh và quyết định tài chính sắc bén.",
                "Thấu hiểu cả hai ngôn ngữ: Ngôn ngữ kỹ thuật số của lập trình viên và ngôn ngữ thị trường của CEO.",
                "Nắm bắt nhanh các mô hình kinh doanh số, sàn thương mại điện tử và tài chính công nghệ."
            ],
            environment: "Fintech, ngân hàng số, tập đoàn thương mại điện tử, công ty tư vấn chiến lược kinh doanh.",
            majors: [
                {
                    name: "Hệ thống Thông tin Quản lý & Khoa học Dữ liệu",
                    match: 96,
                    reason: "Cầu nối sống còn giữa phòng kỹ thuật phần mềm và ban giám đốc chiến lược.",
                    careers: "Business Analyst (BA), Data Scientist, Quản lý dự án CNTT (IT PM).",
                    keywords: ["hệ thống thông tin", "khoa học dữ liệu", "phân tích dữ liệu", "kinh doanh số"]
                },
                {
                    name: "Công nghệ Tài chính (Fintech) & Ngân hàng Số",
                    match: 94,
                    reason: "Thanh toán không tiền mặt, blockchain, chấm điểm tín dụng AI và đầu tư thuật toán.",
                    careers: "Chuyên viên Fintech, Quản lý rủi ro thuật toán, Chuyên gia ngân hàng số.",
                    keywords: ["công nghệ tài chính", "tài chính", "ngân hàng"]
                },
                {
                    name: "Logistics & Quản lý Chuỗi Cung Ứng",
                    match: 91,
                    reason: "Mạch máu của thương mại toàn cầu, tối ưu hóa tuyến đường vận chuyển bằng dữ liệu.",
                    careers: "Chuyên viên phân tích chuỗi cung ứng, Quản lý vận tải quốc tế, Chuyên viên kho bãi thông minh.",
                    keywords: ["logistics", "chuỗi cung ứng", "kinh tế vận tải"]
                },
                {
                    name: "Thương mại Điện tử & Kinh doanh Quốc tế",
                    match: 88,
                    reason: "Vận hành các nền tảng thương mại đa kênh, xuất nhập khẩu số xuyên biên giới.",
                    careers: "Quản trị sàn E-commerce, Chuyên viên xuất nhập khẩu số, Giám đốc tăng trưởng (Growth).",
                    keywords: ["thương mại điện tử", "kinh doanh quốc tế", "kinh tế đối ngoại"]
                }
            ]
        },
        "EI": {
            code: "EI",
            title: "Nhà Lãnh Đạo Công Nghệ & Khởi Nghiệp Đổi Mới",
            subtitle: "Tham vọng dẫn đầu thị trường bằng những giải pháp và sản phẩm công nghệ đột phá.",
            color: "indigo",
            strengths: [
                "Khả năng nhận diện khoảng trống thị trường và nhanh chóng huy động nguồn lực triển khai.",
                "Kỹ năng thuyết trình, kêu gọi vốn và truyền cảm hứng cho đội ngũ nhân sự.",
                "Tư duy ra quyết định dựa trên dữ liệu (Data-driven decision making)."
            ],
            environment: "Startup công nghệ, quỹ đầu tư mạo hiểm (VC), tập đoàn đa quốc gia đổi mới sáng tạo.",
            majors: [
                {
                    name: "Quản trị Kinh doanh & Khởi nghiệp Sáng tạo",
                    match: 95,
                    reason: "Đào tạo tư duy lãnh đạo toàn diện, xây dựng và vận hành doanh nghiệp từ con số 0.",
                    careers: "CEO/Founder startup, Giám đốc phát triển kinh doanh, Trợ lý tổng giám đốc.",
                    keywords: ["quản trị kinh doanh", "khởi nghiệp", "kinh doanh quốc tế"]
                },
                {
                    name: "Thương mại Điện tử & Kinh tế Số",
                    match: 93,
                    reason: "Thị trường nghìn tỷ đang định hình lại toàn bộ nền kinh tế tiêu dùng.",
                    careers: "Giám đốc kinh doanh số, Quản lý đối tác chiến lược công nghệ.",
                    keywords: ["thương mại điện tử", "kinh tế số", "kinh doanh số"]
                },
                {
                    name: "Marketing & Truyền thông Tích hợp (IMC)",
                    match: 90,
                    reason: "Nắm bắt tâm lý hành vi người tiêu dùng và xây dựng chiến dịch bán hàng bùng nổ.",
                    careers: "Giám đốc Marketing (CMO), Brand Manager, Performance Marketer.",
                    keywords: ["marketing", "quảng cáo", "truyền thông marketing"]
                },
                {
                    name: "Kinh doanh Quốc tế & Kinh tế Đối ngoại",
                    match: 87,
                    reason: "Giao thương thương mại toàn cầu, đàm phán hợp đồng thương mại quốc tế.",
                    careers: "Chuyên viên đàm phán quốc tế, Chuyên viên xúc tiến thương mại.",
                    keywords: ["kinh doanh quốc tế", "kinh tế quốc tế", "kinh tế đối ngoại"]
                }
            ]
        },
        "EC": {
            code: "EC",
            title: "Nhà Quản Lý Tài Chính & Doanh Nghiệp Chuẩn Mực",
            subtitle: "Sự kết hợp giữa nhạy bén kinh doanh và tính kỷ luật, chuẩn xác cao về quy trình tài chính.",
            color: "emerald",
            strengths: [
                "Khả năng kiểm soát ngân sách, dòng tiền và phân bổ vốn chặt chẽ.",
                "Hiểu sâu về luật thuế, chính sách tài khóa và chuẩn mực báo cáo tài chính.",
                "Tác phong làm việc chuẩn mực, bảo mật và đáng tin cậy cao độ."
            ],
            environment: "Ngân hàng thương mại, các công ty kiểm toán Big 4, phòng tài chính doanh nghiệp lớn.",
            majors: [
                {
                    name: "Tài chính - Ngân hàng & Đầu tư Tài sản",
                    match: 97,
                    reason: "Trụ cột huyết mạch của nền kinh tế, quản lý vốn và gia tăng lợi nhuận đầu tư.",
                    careers: "Chuyên viên phân tích đầu tư, Chuyên viên tín dụng ngân hàng, Chuyên gia quản trị tài sản.",
                    keywords: ["tài chính", "ngân hàng", "đầu tư", "chứng khoán"]
                },
                {
                    name: "Kế toán & Kiểm toán Chuẩn mực Quốc tế (ACCA/CPA)",
                    match: 94,
                    reason: "Ngôn ngữ của kinh doanh, bảo đảm tính minh bạch và an toàn tài chính tuyệt đối.",
                    careers: "Kiểm toán viên Big 4, Kế toán trưởng, Chuyên viên tư vấn thuế.",
                    keywords: ["kế toán", "kiểm toán"]
                },
                {
                    name: "Luật Kinh tế & Pháp chế Doanh nghiệp",
                    match: 91,
                    reason: "Lá chắn pháp lý bảo vệ doanh nghiệp trong các thương vụ M&A và tranh chấp hợp đồng.",
                    careers: "Luật sư kinh tế, Giám đốc pháp chế (Head of Legal), Trọng tài thương mại.",
                    keywords: ["luật kinh tế", "luật thương mại", "luật"]
                },
                {
                    name: "Quản trị Doanh nghiệp & Quản trị Rủi ro",
                    match: 88,
                    reason: "Xây dựng quy trình vận hành tối ưu, phòng chống gian lận và rủi ro thị trường.",
                    careers: "Risk Manager, Chuyên viên kiểm soát nội bộ, Trợ lý vận hành.",
                    keywords: ["quản trị kinh doanh", "quản lý công", "quản trị nhân lực"]
                }
            ]
        },
        "CE": {
            code: "CE",
            title: "Chuyên Gia Thẩm Định Tài Chính & Kiểm Soát Rủi Ro",
            subtitle: "Chuẩn xác, tỉ mỉ trong từng con số với tư duy kinh tế sắc bén.",
            color: "slate",
            strengths: [
                "Khả năng phát hiện sai sót, lỗ hổng số liệu cực kỳ tinh tế.",
                "Kỷ luật tuân thủ cao, tôn trọng nguyên tắc và đạo đức nghề nghiệp.",
                "Phân tích báo cáo tài chính và thẩm định phương án kinh doanh chi tiết."
            ],
            environment: "Hãng kiểm toán, cơ quan quản lý thị trường, ban kiểm soát tập đoàn, cục thuế.",
            majors: [
                {
                    name: "Kiểm toán & Kế toán Quản trị",
                    match: 96,
                    reason: "Nghề nghiệp đòi hỏi tính chuẩn mực, chính xác cao và lộ trình thăng tiến rõ ràng.",
                    careers: "Kiểm toán viên độc lập, Kiểm toán nội bộ, Kế toán trưởng.",
                    keywords: ["kiểm toán", "kế toán"]
                },
                {
                    name: "Tài chính Doanh nghiệp & Thẩm định Giá",
                    match: 93,
                    reason: "Định giá dự án, định giá tài sản doanh nghiệp trước các thương vụ đầu tư lớn.",
                    careers: "Thẩm định viên tài chính, Chuyên viên định giá M&A, Quản trị vốn.",
                    keywords: ["tài chính", "ngân hàng", "đầu tư"]
                },
                {
                    name: "Hệ thống Thông tin Kế toán & Phân tích Tài chính",
                    match: 89,
                    reason: "Ứng dụng ERP (SAP, Oracle) trong việc quản lý dữ liệu tài chính kế toán tự động.",
                    careers: "Chuyên viên ERP Tài chính, Chuyên viên đối soát dữ liệu ngân hàng.",
                    keywords: ["hệ thống thông tin", "kế toán", "tài chính"]
                },
                {
                    name: "Quản trị Văn phòng & Quản lý Hành chính Công",
                    match: 86,
                    reason: "Vận hành hệ thống tài liệu, quy chế nội bộ và hành chính văn thư bài bản.",
                    careers: "Chánh văn phòng, Quản lý hồ sơ pháp lý, Thư ký ban giám đốc.",
                    keywords: ["quản trị văn phòng", "hành chính", "quản lý công", "văn thư"]
                }
            ]
        },
        "EA": {
            code: "EA",
            title: "Nhà Sáng Tạo Thương Hiệu & Truyền Thông Marketing",
            subtitle: "Sự thăng hoa giữa ý tưởng nghệ thuật khác biệt và mục tiêu thương mại thực tế.",
            color: "rose",
            strengths: [
                "Nắm bắt trào lưu văn hóa (trend) nhanh nhạy, biến ý tưởng thành chiến dịch lan tỏa.",
                "Khả năng thấu cảm cảm xúc khách hàng và xây dựng câu chuyện thương hiệu (Storytelling).",
                "Kỹ năng thuyết phục khách hàng và đàm phán hợp đồng tài trợ, quảng bá."
            ],
            environment: "Creative Agency, phòng Marketing tập đoàn, công ty tổ chức sự kiện, thương hiệu thời trang.",
            majors: [
                {
                    name: "Marketing Số & Quản trị Thương hiệu",
                    match: 97,
                    reason: "Ngành nghề hot hàng đầu cho các bạn trẻ thích sáng tạo và kiếm tìm thu nhập cao.",
                    careers: "Brand Manager, Creative Director, Giám đốc chiến dịch quảng cáo.",
                    keywords: ["marketing", "quảng cáo", "truyền thông marketing", "thương hiệu"]
                },
                {
                    name: "Quan hệ Công chúng (PR) & Quản trị Sự kiện",
                    match: 94,
                    reason: "Xây dựng hình ảnh cá nhân/tổ chức, quản trị khủng hoảng và tổ chức sự kiện quy mô lớn.",
                    careers: "Chuyên viên PR, Nhà sản xuất sự kiện (Event Producer), Người phát ngôn.",
                    keywords: ["quan hệ công chúng", "sự kiện", "quảng bá", "truyền thông"]
                },
                {
                    name: "Quản trị Khách sạn, Nhà hàng & Du lịch Quốc tế",
                    match: 90,
                    reason: "Ngành công nghiệp không khói sôi động, kết nối văn hóa và dịch vụ thượng lưu.",
                    careers: "Quản lý khách sạn 5 sao, Chuyên gia trải nghiệm khách hàng, Quản lý resort.",
                    keywords: ["du lịch", "khách sạn", "nhà hàng", "lữ hành"]
                },
                {
                    name: "Kiến trúc & Thiết kế Nội thất",
                    match: 87,
                    reason: "Kiến tạo không gian sống tiện nghi, thẩm mỹ cao kết hợp kinh doanh bất động sản.",
                    careers: "Kiến trúc sư, Nhà thiết kế nội thất, Giám đốc sáng tạo không gian.",
                    keywords: ["kiến trúc", "nội thất", "quy hoạch", "thiết kế"]
                }
            ]
        },
        "AS": {
            code: "AS",
            title: "Nhà Báo, Nhà Truyền Thông & Sáng Tạo Xã Hội",
            subtitle: "Dùng ngòi bút, hình ảnh và câu chuyện nhân văn để kết nối và truyền cảm hứng cộng đồng.",
            color: "rose",
            strengths: [
                "Ngôn từ giàu cảm xúc, khả năng biểu đạt ý niệm phức tạp qua hình ảnh, video.",
                "Tâm hồn nhạy cảm, thấu hiểu nỗi đau và tâm lý sâu kín của con người.",
                "Yêu thích sự tự do, tôn trọng sự đa dạng văn hóa và không chịu gò bó lối mòn."
            ],
            environment: "Tòa soạn báo, đài truyền hình, kênh truyền thông số, tổ chức văn hóa, nhà xuất bản.",
            majors: [
                {
                    name: "Truyền thông Đa phương tiện & Thiết kế Đồ họa",
                    match: 96,
                    reason: "Sáng tạo visual, video viral, podcast và giao diện đồ họa sống động cho thế hệ số.",
                    careers: "Graphic Designer, Video Editor, Content Creator, Chuyên viên truyền thông số.",
                    keywords: ["truyền thông đa phương tiện", "thiết kế đồ họa", "mỹ thuật", "hoạt hình", "game"]
                },
                {
                    name: "Báo chí, Xuất bản & Viết lách Chuyên nghiệp",
                    match: 93,
                    reason: "Tiếng nói của xã hội, phản ánh sự thật và kiến tạo các tác phẩm văn hóa giá trị.",
                    careers: "Nhà báo, Phóng viên điều tra, Biên tập viên xuất bản, Biên kịch phim.",
                    keywords: ["báo chí", "xuất bản", "văn học", "truyền hình"]
                },
                {
                    name: "Ngôn ngữ Anh & Biên phiên dịch Quốc tế",
                    match: 91,
                    reason: "Chìa khóa hội nhập toàn cầu, cầu nối chuyển ngữ văn hóa và kinh tế.",
                    careers: "Biên phiên dịch viên cấp cao, Điều phối viên quốc tế, Giảng viên ngôn ngữ.",
                    keywords: ["ngôn ngữ anh", "ngôn ngữ trung", "ngôn ngữ hàn", "ngôn ngữ nhật", "tiếng anh"]
                },
                {
                    name: "Tâm lý học Ứng dụng & Công tác Xã hội",
                    match: 88,
                    reason: "Trị liệu tâm lý, chữa lành tinh thần và hỗ trợ các nhóm yếu thế trong cộng đồng.",
                    careers: "Chuyên gia tham vấn tâm lý học đường, Nhân viên công tác xã hội, Chuyên viên trị liệu.",
                    keywords: ["tâm lý học", "công tác xã hội", "xã hội học"]
                }
            ]
        },
        "IS": {
            code: "IS",
            title: "Bác Sĩ, Dược Sĩ & Chuyên Gia Y Khoa",
            subtitle: "Sự kết hợp cao quý giữa trí tuệ khoa học nghiêm ngặt và trái tim nhân ái vì mạng sống con người.",
            color: "cyan",
            strengths: [
                "Khả năng học tập nghiên cứu cường độ cao, ghi nhớ và tổng hợp lượng kiến thức y sinh đồ sộ.",
                "Đức tính cẩn trọng, tỉ mỉ, bình tĩnh trước áp lực và tình huống khẩn cấp.",
                "Lòng trắc ẩn sâu sắc, tinh thần trách nhiệm y đức bảo vệ sức khỏe nhân dân."
            ],
            environment: "Bệnh viện tuyến đầu, viện nghiên cứu vắc-xin/dược phẩm, các trường đại học y dược.",
            majors: [
                {
                    name: "Y Đa khoa & Bác sĩ Chuyên khoa",
                    match: 98,
                    reason: "Nghề nghiệp danh giá bậc nhất, trực tiếp chẩn đoán và điều trị cứu sống con người.",
                    careers: "Bác sĩ Nội trú, Bác sĩ Phẫu thuật, Trưởng khoa Bệnh viện.",
                    keywords: ["y đa khoa", "y khoa", "bác sĩ", "răng hàm mặt", "y học cổ truyền"]
                },
                {
                    name: "Dược học & Công nghệ Sinh học Dược",
                    match: 95,
                    reason: "Nghiên cứu, bào chế thuốc chữa bệnh, dược liệu và sản phẩm chăm sóc sức khỏe.",
                    careers: "Dược sĩ lâm sàng, Chuyên viên R&D dược phẩm, Quản lý nhà máy sản xuất thuốc.",
                    keywords: ["dược", "dược học", "hóa dược", "công nghệ sinh học"]
                },
                {
                    name: "Răng - Hàm - Mặt & Thẩm mỹ Y khoa",
                    match: 92,
                    reason: "Chăm sóc nụ cười và sức khỏe răng miệng với thu nhập và cơ hội mở phòng khám riêng cao.",
                    careers: "Bác sĩ Răng Hàm Mặt, Chuyên gia chỉnh nha, Bác sĩ thẩm mỹ nụ cười.",
                    keywords: ["răng hàm mặt", "nha khoa"]
                },
                {
                    name: "Điều dưỡng & Kỹ thuật Xét nghiệm Y học",
                    match: 89,
                    reason: "Đóng vai trò then chốt trong chăm sóc bệnh nhân và hỗ trợ chẩn đoán hình ảnh chính xác.",
                    careers: "Điều dưỡng trưởng, Kỹ thuật viên xét nghiệm máu/vi sinh, Chuyên viên thiết bị y tế.",
                    keywords: ["điều dưỡng", "kỹ thuật y học", "xét nghiệm", "y tế công cộng"]
                }
            ]
        },
        "SE": {
            code: "SE",
            title: "Nhà Lãnh Đạo Xã Hội, Giáo Dục & Luật Pháp",
            subtitle: "Đam mê xây dựng xã hội công bằng, đào tạo thế hệ tương lai và quản lý cộng đồng.",
            color: "emerald",
            strengths: [
                "Khả năng diễn đạt hùng biện, bảo vệ lẽ phải và công lý.",
                "Kỹ năng kết nối mạng lưới con người, hòa giải xung đột và lãnh đạo tập thể.",
                "Tận tụy, kiên nhẫn trong việc giáo dục, đào tạo và phát triển năng lực người khác."
            ],
            environment: "Tòa án, văn phòng luật sư, trường đại học, cơ quan quản lý giáo dục, tổ chức ngoại giao.",
            majors: [
                {
                    name: "Luật học & Pháp luật Thương mại",
                    match: 96,
                    reason: "Bảo vệ cán cân công lý, tư vấn pháp lý cho các thể chế và doanh nghiệp.",
                    careers: "Luật sư tranh tụng, Thẩm phán, Kiểm sát viên, Công chứng viên.",
                    keywords: ["luật", "luật học", "quan hệ quốc tế"]
                },
                {
                    name: "Sư phạm & Quản lý Giáo dục",
                    match: 94,
                    reason: "Khuôn vàng thước ngọc đào tạo nhân tài cho đất nước, việc làm bền vững.",
                    careers: "Giáo viên trường THPT chất lượng cao, Giảng viên đại học, Quản lý trường học.",
                    keywords: ["sư phạm", "giáo dục", "sư phạm toán", "sư phạm ngữ văn", "sư phạm tiếng anh"]
                },
                {
                    name: "Quản trị Nhân lực & Phát triển Tổ chức",
                    match: 91,
                    reason: "Tìm kiếm, tuyển dụng và bồi dưỡng nhân tài - tài sản quý giá nhất của mọi công ty.",
                    careers: "HR Manager, Chuyên gia tuyển dụng cấp cao (Headhunter), Chuyên viên đào tạo nội bộ.",
                    keywords: ["quản trị nhân lực", "nhân sự", "tâm lý học"]
                },
                {
                    name: "Ngoại giao & Quốc tế học",
                    match: 88,
                    reason: "Đại diện quốc gia trên trường quốc tế, thúc đẩy hợp tác chính trị - kinh tế.",
                    careers: "Nhà ngoại giao, Chuyên viên bộ ngoại giao, Điều phối viên dự án quốc tế.",
                    keywords: ["ngoại giao", "quốc tế học", "đông phương học"]
                }
            ]
        },
        "RC": {
            code: "RC",
            title: "Kỹ Sư Công Trình, Vận Hành & Giám Sát Kỹ Thuật",
            subtitle: "Đảm bảo sự an toàn tuyệt đối, độ chính xác cao của các công trình và hạ tầng quốc gia.",
            color: "slate",
            strengths: [
                "Tuân thủ nghiêm ngặt tiêu chuẩn an toàn lao động và quy chuẩn kỹ thuật xây dựng.",
                "Khả năng giám sát thi công, nghiệm thu chất lượng công trình và đo đạc thực địa.",
                "Tác phong thực tế, kiên định, chịu được áp lực tiến độ tại công trường."
            ],
            environment: "Ban quản lý dự án xây dựng, cơ quan kiểm định chất lượng, tổng công ty hạ tầng giao thông.",
            majors: [
                {
                    name: "Kỹ thuật Xây dựng & Công trình Thủy lợi - Giao thông",
                    match: 96,
                    reason: "Xây đắp các cây cầu thế kỷ, hầm vượt biển, đập thủy điện và sân bay huyết mạch.",
                    careers: "Kỹ sư giám sát thi công, Chỉ huy trưởng công trường, Kỹ sư trắc địa công trình.",
                    keywords: ["xây dựng", "cầu đường", "giao thông", "hạ tầng", "công trình thủy"]
                },
                {
                    name: "Quản lý Đất đai & Trắc địa - Bản đồ",
                    match: 92,
                    reason: "Đo đạc vệ tinh, quy hoạch sử dụng đất và cấp giấy chứng nhận bất động sản.",
                    careers: "Kỹ sư trắc địa viễn thám, Chuyên viên phòng tài nguyên môi trường, Quy hoạch đất đai.",
                    keywords: ["đất đai", "trắc địa", "bản đồ", "địa chính", "môi trường"]
                },
                {
                    name: "Kỹ thuật Hàng hải & Khoa học Hàng hải",
                    match: 89,
                    reason: "Chỉ huy những con tàu viễn dương vượt sóng lớn đưa hàng hóa đi khắp năm châu.",
                    careers: "Thuyền trưởng tàu biển, Sĩ quan hàng hải, Kỹ sư máy tàu biển.",
                    keywords: ["hàng hải", "tàu thủy", "điều khiển tàu"]
                },
                {
                    name: "Nông nghiệp Công nghệ cao & Thú y",
                    match: 86,
                    reason: "Áp dụng công nghệ sinh học và tự động hóa vào sản xuất nông nghiệp sạch bền vững.",
                    careers: "Bác sĩ thú y, Quản lý trang trại công nghệ cao, Kỹ sư giống cây trồng.",
                    keywords: ["nông nghiệp", "thú y", "lâm nghiệp", "thủy sản"]
                }
            ]
        }
    };

    // State của AI Career Quiz
    let careerCurrentStep = 0;
    let careerAnswers = {
        1: null,
        2: [],
        3: null,
        4: null,
        5: null,
        6: {
            score: "",
            examType: "thpt",
            combo: "",
            region: "all"
        }
    };

    function initCareerQuiz() {
        if (!careerQuestionView) return;
        renderCurrentCareerQuestion();

        if (btnCareerNext && !btnCareerNext.dataset.bound) {
            btnCareerNext.dataset.bound = "true";
            btnCareerNext.addEventListener("click", handleCareerNext);
        }
        if (btnCareerPrev && !btnCareerPrev.dataset.bound) {
            btnCareerPrev.dataset.bound = "true";
            btnCareerPrev.addEventListener("click", handleCareerPrev);
        }
        if (btnCareerReset && !btnCareerReset.dataset.bound) {
            btnCareerReset.dataset.bound = "true";
            btnCareerReset.addEventListener("click", resetCareerQuiz);
        }
    }

    function renderCurrentCareerQuestion() {
        if (!careerQuestionView) return;
        const total = RIASEC_QUESTIONS.length;
        const q = RIASEC_QUESTIONS[careerCurrentStep];
        if (!q) return;

        // Cập nhật indicator & progress bar
        if (careerStepIndicator) {
            careerStepIndicator.textContent = `Câu hỏi ${careerCurrentStep + 1} / ${total}`;
        }
        if (careerProgressBar) {
            const pct = Math.round(((careerCurrentStep + 1) / total) * 100);
            careerProgressBar.style.width = `${pct}%`;
        }

        // Cập nhật nút Next / Submit
        if (btnCareerPrev) {
            btnCareerPrev.disabled = careerCurrentStep === 0;
        }
        if (btnCareerNext) {
            if (careerCurrentStep === total - 1) {
                if (careerNextText) careerNextText.textContent = "Xem Kết Quả Phân Tích AI";
                if (careerNextIcon) careerNextIcon.className = "fa-solid fa-wand-magic-sparkles";
            } else {
                if (careerNextText) careerNextText.textContent = "Câu tiếp theo";
                if (careerNextIcon) careerNextIcon.className = "fa-solid fa-arrow-right";
            }
        }

        // Render nội dung câu hỏi
        if (q.type === "profile") {
            renderCareerProfileQuestion(q);
        } else {
            renderCareerChoiceQuestion(q);
        }
    }

    function renderCareerChoiceQuestion(q) {
        const selected = careerAnswers[q.id];
        let optionsHtml = "";

        q.options.forEach(opt => {
            let isSelected = false;
            if (q.type === "multi") {
                isSelected = Array.isArray(selected) && selected.includes(opt.code);
            } else {
                isSelected = selected === opt.code;
            }

            const borderClass = isSelected
                ? "border-amber-500 bg-amber-50/70 shadow-md ring-2 ring-amber-400/40"
                : "border-slate-200 hover:border-amber-300 hover:bg-slate-50/80 bg-white";

            const checkHtml = isSelected
                ? `<div class="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shadow-xs"><i class="fa-solid fa-check"></i></div>`
                : `<div class="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center"></div>`;

            optionsHtml += `
                <div class="career-option-card p-4 rounded-2xl border-2 ${borderClass} cursor-pointer transition-all flex items-start gap-3.5 select-none"
                     data-qid="${q.id}" data-code="${opt.code}" data-multi="${q.type === 'multi'}">
                    <div class="w-10 h-10 rounded-xl bg-${opt.color || 'amber'}-100 text-${opt.color || 'amber'}-700 flex items-center justify-center text-lg shrink-0 mt-0.5">
                        <i class="fa-solid ${opt.icon}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2 mb-1">
                            <h4 class="font-extrabold text-slate-800 text-sm sm:text-base">${escapeHtml(opt.title)}</h4>
                            ${checkHtml}
                        </div>
                        <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">${escapeHtml(opt.desc)}</p>
                    </div>
                </div>
            `;
        });

        careerQuestionView.innerHTML = `
            <div class="space-y-2 mb-4">
                <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">${escapeHtml(q.title)}</h3>
                <p class="text-xs sm:text-sm text-slate-500">${escapeHtml(q.subtitle)}</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                ${optionsHtml}
            </div>
        `;

        // Gắn sự kiện click vào các thẻ option
        careerQuestionView.querySelectorAll(".career-option-card").forEach(el => {
            el.addEventListener("click", () => {
                const qid = parseInt(el.dataset.qid);
                const code = el.dataset.code;
                const isMulti = el.dataset.multi === "true";

                if (isMulti) {
                    if (!Array.isArray(careerAnswers[qid])) careerAnswers[qid] = [];
                    const idx = careerAnswers[qid].indexOf(code);
                    if (idx > -1) {
                        careerAnswers[qid].splice(idx, 1);
                    } else {
                        if (careerAnswers[qid].length < (q.maxSelect || 3)) {
                            careerAnswers[qid].push(code);
                        }
                    }
                } else {
                    careerAnswers[qid] = code;
                }
                renderCurrentCareerQuestion();
            });
        });
    }

    function renderCareerProfileQuestion(q) {
        const prof = careerAnswers[6] || {};
        careerQuestionView.innerHTML = `
            <div class="space-y-2 mb-4">
                <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">${escapeHtml(q.title)}</h3>
                <p class="text-xs sm:text-sm text-slate-500">${escapeHtml(q.subtitle)}</p>
            </div>
            <div class="bg-gradient-to-br from-slate-50 to-amber-50/30 p-5 sm:p-6 rounded-2xl border border-amber-200/60 space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <!-- Loại kỳ thi -->
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            🎯 1. Kỳ thi bạn sử dụng xét tuyển
                        </label>
                        <select id="career-input-exam" class="w-full py-2.5 px-3 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:outline-none focus:border-amber-500 bg-white shadow-xs">
                            <option value="thpt" ${prof.examType === 'thpt' ? 'selected' : ''}>Điểm thi tốt nghiệp THPT (thang 30)</option>
                            <option value="tsa" ${prof.examType === 'tsa' ? 'selected' : ''}>Đánh giá tư duy Bách Khoa (TSA / K00, thang 100)</option>
                            <option value="hsa" ${prof.examType === 'hsa' ? 'selected' : ''}>Đánh giá năng lực ĐHQG Hà Nội (HSA / Q00, thang 150)</option>
                        </select>
                    </div>

                    <!-- Mức điểm -->
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            📊 2. Điểm thi đạt được / Dự kiến (thực tế)
                        </label>
                        <input type="number" step="0.05" id="career-input-score" value="${escapeHtml(prof.score || '')}"
                               placeholder="Ví dụ: 24.5 (THPT) hoặc 72.0 (TSA)..."
                               class="w-full py-2.5 px-3 rounded-xl border border-slate-300 font-extrabold text-slate-800 text-sm focus:outline-none focus:border-amber-500 bg-white shadow-xs">
                    </div>

                    <!-- Tổ hợp môn -->
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            📚 3. Tổ hợp môn sở trường (hoặc mã riêng)
                        </label>
                        <input type="text" id="career-input-combo" value="${escapeHtml(prof.combo || '')}"
                               placeholder="Ví dụ: A00, A01, D01, B00, K00..."
                               class="w-full py-2.5 px-3 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:outline-none focus:border-amber-500 bg-white shadow-xs uppercase">
                    </div>

                    <!-- Khu vực đào tạo -->
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            📍 4. Khu vực đại học ưu tiên
                        </label>
                        <select id="career-input-region" class="w-full py-2.5 px-3 rounded-xl border border-slate-300 font-bold text-slate-800 text-sm focus:outline-none focus:border-amber-500 bg-white shadow-xs">
                            <option value="all" ${prof.region === 'all' ? 'selected' : ''}>Toàn quốc (Tất cả 299 trường)</option>
                            <option value="hanoi" ${prof.region === 'hanoi' ? 'selected' : ''}>Hà Nội & Khu vực Miền Bắc</option>
                            <option value="hcm" ${prof.region === 'hcm' ? 'selected' : ''}>TP. Hồ Chí Minh & Miền Nam</option>
                            <option value="mientrung" ${prof.region === 'mientrung' ? 'selected' : ''}>Đà Nẵng & Khu vực Miền Trung</option>
                        </select>
                    </div>
                </div>

                <div class="text-xs text-slate-500 italic flex items-center gap-2 pt-1">
                    <i class="fa-solid fa-circle-info text-amber-500"></i>
                    <span>Bạn có thể để trống nếu chỉ muốn xem gợi ý nhóm ngành nghề mà chưa cần đối chiếu điểm chuẩn trường đại học.</span>
                </div>
            </div>
        `;

        // Sync inputs back to state
        const inputScore = document.getElementById("career-input-score");
        const inputExam = document.getElementById("career-input-exam");
        const inputCombo = document.getElementById("career-input-combo");
        const inputRegion = document.getElementById("career-input-region");

        if (inputScore) inputScore.addEventListener("input", e => careerAnswers[6].score = e.target.value.trim());
        if (inputExam) inputExam.addEventListener("change", e => careerAnswers[6].examType = e.target.value);
        if (inputCombo) inputCombo.addEventListener("input", e => careerAnswers[6].combo = e.target.value.trim().toUpperCase());
        if (inputRegion) inputRegion.addEventListener("change", e => careerAnswers[6].region = e.target.value);
    }

    function handleCareerNext() {
        const total = RIASEC_QUESTIONS.length;
        // Kiểm tra câu hỏi hiện tại đã chọn chưa (ngoại trừ câu 6 là profile tùy chọn)
        if (careerCurrentStep < total - 1) {
            const currentQ = RIASEC_QUESTIONS[careerCurrentStep];
            const ans = careerAnswers[currentQ.id];
            if (currentQ.type === "multi") {
                if (!Array.isArray(ans) || ans.length === 0) {
                    alert("Vui lòng chọn ít nhất 1 phương án trước khi sang câu tiếp theo!");
                    return;
                }
            } else {
                if (!ans) {
                    alert("Vui lòng chọn 1 phương án phù hợp nhất với bạn!");
                    return;
                }
            }
            careerCurrentStep++;
            renderCurrentCareerQuestion();
        } else {
            // Hoàn thành trắc nghiệm -> Chạy thuật toán AI
            runCareerAnalysis();
        }
    }

    function handleCareerPrev() {
        if (careerCurrentStep > 0) {
            careerCurrentStep--;
            renderCurrentCareerQuestion();
        }
    }

    function resetCareerQuiz() {
        careerCurrentStep = 0;
        careerAnswers = {
            1: null,
            2: [],
            3: null,
            4: null,
            5: null,
            6: { score: "", examType: "thpt", combo: "", region: "all" }
        };
        if (careerQuizCard) careerQuizCard.classList.remove("hidden");
        if (careerResultsCard) {
            careerResultsCard.classList.add("hidden");
            careerResultsCard.innerHTML = "";
        }
        renderCurrentCareerQuestion();
    }

    // Thuật toán tính điểm RIASEC
    function computeRiasecScores() {
        const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

        // Q1: Hệ số x2 (Sở thích hoạt động chính)
        if (careerAnswers[1]) scores[careerAnswers[1]] += 2.0;

        // Q2: Môn học (mỗi môn được chọn +1.5)
        if (Array.isArray(careerAnswers[2])) {
            careerAnswers[2].forEach(code => scores[code] += 1.5);
        }

        // Q3: Môi trường làm việc (+1.5)
        if (careerAnswers[3]) scores[careerAnswers[3]] += 1.5;

        // Q4: Giải quyết vấn đề (+1.5)
        if (careerAnswers[4]) scores[careerAnswers[4]] += 1.5;

        // Q5: Giá trị nghề nghiệp cốt lõi (+2.0)
        if (careerAnswers[5]) scores[careerAnswers[5]] += 2.0;

        const totalPoints = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
        const percentages = {};
        for (const k of Object.keys(scores)) {
            percentages[k] = Math.round((scores[k] / totalPoints) * 100);
        }

        // Sắp xếp các nhóm theo điểm từ cao xuống thấp
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const primaryCode = sorted[0][0];
        const secondaryCode = sorted[1][0];
        const hollandCode = `${primaryCode}${secondaryCode}`;

        return {
            scores,
            percentages,
            sorted,
            primaryCode,
            secondaryCode,
            hollandCode
        };
    }

    async function runCareerAnalysis() {
        if (!careerResultsCard) return;
        await loadStaticDataIfNeeded();

        const riasec = computeRiasecScores();
        let archetype = HOLLAND_ARCHETYPES[riasec.hollandCode] ||
                        HOLLAND_ARCHETYPES[`${riasec.secondaryCode}${riasec.primaryCode}`] ||
                        HOLLAND_ARCHETYPES["IR"]; // Fallback chuẩn

        const profileInput = careerAnswers[6] || {};
        const userScore = profileInput.score ? parseFloat(profileInput.score) : null;
        const examType = profileInput.examType || "thpt";
        const targetRegion = profileInput.region || "all";

        // Tìm kiếm các trường đại học thực tế trong staticScoresData
        const matchedSchoolsByMajor = matchUniversitiesForMajors(archetype.majors, userScore, examType, targetRegion);

        // Render toàn bộ giao diện kết quả
        renderCareerResultsUI(riasec, archetype, matchedSchoolsByMajor, userScore, examType);

        if (careerQuizCard) careerQuizCard.classList.add("hidden");
        careerResultsCard.classList.remove("hidden");
        careerResultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function matchUniversitiesForMajors(recommendedMajors, userScore, examType, targetRegion) {
        if (!staticScoresData || !Array.isArray(staticScoresData)) return [];

        const results = [];

        recommendedMajors.forEach(majorGroup => {
            const groupKeywords = majorGroup.keywords.map(k => k.toLowerCase());
            const matchedUniversities = [];

            staticScoresData.forEach(item => {
                const mName = (item.major_name || "").toLowerCase();
                const uName = (item.university_name || "").toLowerCase();
                const uCode = (item.university_code || "").toUpperCase();

                // 1. Kiểm tra từ khóa tên ngành
                const isMatchMajor = groupKeywords.some(kw => mName.includes(kw));
                if (!isMatchMajor) return;

                // 2. Lọc khu vực
                if (targetRegion === "hanoi") {
                    const isNorth = ["hà nội", "bách khoa hà nội", "quốc gia hà nội", "hải phòng", "thái nguyên", "nam định"].some(k => uName.includes(k)) ||
                                    ["BKA", "KHA", "NTH", "SPH", "YHB", "GTA", "TMU", "HTC", "NHH"].includes(uCode);
                    if (!isNorth) return;
                } else if (targetRegion === "hcm") {
                    const isSouth = ["hồ chí minh", "tp.hcm", "sài gòn", "cần thơ", "bình dương", "đồng nai"].some(k => uName.includes(k)) ||
                                    ["QSB", "QST", "UEH", "SG", "IUH", "DKC", "NTS"].includes(uCode);
                    if (!isSouth) return;
                } else if (targetRegion === "mientrung") {
                    const isCentral = ["đà nẵng", "huế", "quy nhơn", "quảng nam", "quảng ngãi", "nha trang", "khánh hòa", "vinh"].some(k => uName.includes(k)) ||
                                      ["DDA", "DDU", "TDN", "HHA"].includes(uCode);
                    if (!isCentral) return;
                }

                // 3. Tìm điểm chuẩn theo kỳ thi tương ứng
                let cutoff = null;
                let cutoffText = "";
                let methodUsed = "";
                let subjectGroup = "";

                (item.methods || []).forEach(m => {
                    const mMethod = m.method || "";
                    if (examType === "tsa" && (mMethod.includes("TSA") || mMethod.includes("tư duy"))) {
                        if (cutoff === null || m.cutoff_score > cutoff) {
                            cutoff = m.cutoff_score;
                            cutoffText = m.cutoff_score_text;
                            methodUsed = mMethod;
                            subjectGroup = m.subject_group;
                        }
                    } else if (examType === "hsa" && (mMethod.includes("HSA") || (mMethod.includes("ĐGNL") && mMethod.includes("Hà Nội")))) {
                        if (cutoff === null || m.cutoff_score > cutoff) {
                            cutoff = m.cutoff_score;
                            cutoffText = m.cutoff_score_text;
                            methodUsed = mMethod;
                            subjectGroup = m.subject_group;
                        }
                    } else if (examType === "thpt") {
                        if (mMethod.includes("THPT") || mMethod.includes("100") || (m.cutoff_score !== null && m.cutoff_score <= 30.5 && m.cutoff_score >= 10.0)) {
                            if (cutoff === null || (m.cutoff_score !== null && m.cutoff_score > cutoff)) {
                                cutoff = m.cutoff_score;
                                cutoffText = m.cutoff_score_text;
                                methodUsed = mMethod || "Điểm thi tốt nghiệp THPT";
                                subjectGroup = m.subject_group;
                            }
                        }
                    }
                });

                if (cutoff !== null && cutoff > 0) {
                    let chance = "info"; // default
                    let diff = null;
                    if (userScore !== null) {
                        diff = Math.round((userScore - cutoff) * 100) / 100;
                        if (diff >= -0.5 && diff <= 1.5) {
                            chance = "target"; // Vừa sức
                        } else if (diff < -0.5 && diff >= -2.5) {
                            chance = "reach"; // Mơ ước / Thách thức
                        } else if (diff > 1.5) {
                            chance = "safety"; // An toàn
                        } else {
                            chance = "hard"; // Khó
                        }
                    }

                    matchedUniversities.push({
                        university_code: item.university_code,
                        university_name: item.university_name,
                        major_name: item.major_name,
                        major_code: item.major_code,
                        year: item.year,
                        cutoff_score: cutoff,
                        cutoff_score_text: cutoffText,
                        method: methodUsed,
                        subject_group: subjectGroup,
                        diff: diff,
                        chance: chance
                    });
                }
            });

            // Sắp xếp các trường: Ưu tiên trường vừa sức -> an toàn -> mơ ước
            matchedUniversities.sort((a, b) => {
                if (userScore !== null) {
                    const weight = { "target": 1, "safety": 2, "reach": 3, "hard": 4, "info": 5 };
                    if (weight[a.chance] !== weight[b.chance]) {
                        return weight[a.chance] - weight[b.chance];
                    }
                }
                return b.cutoff_score - a.cutoff_score;
            });

            results.push({
                group: majorGroup,
                universities: matchedUniversities.slice(0, 8) // Lấy top 8 trường tiêu biểu
            });
        });

        return results;
    }

    function renderCareerResultsUI(riasec, archetype, matchedSchoolsByMajor, userScore, examType) {
        const { percentages, hollandCode, primaryCode, secondaryCode } = riasec;

        const dimNames = {
            "R": "Realistic (Thực tế - Kỹ thuật)",
            "I": "Investigative (Nghiên cứu - Logic)",
            "A": "Artistic (Nghệ thuật - Sáng tạo)",
            "S": "Social (Xã hội - Giúp đỡ)",
            "E": "Enterprising (Kinh doanh - Quản lý)",
            "C": "Conventional (Quy củ - Nghiệp vụ)"
        };

        const dimColors = {
            "R": "bg-amber-500",
            "I": "bg-blue-600",
            "A": "bg-rose-500",
            "S": "bg-emerald-500",
            "E": "bg-indigo-600",
            "C": "bg-slate-600"
        };

        // Render RIASEC Bars
        let barsHtml = "";
        for (const [dim, name] of Object.entries(dimNames)) {
            const pct = percentages[dim] || 0;
            const barBg = dimColors[dim];
            const isHighlight = dim === primaryCode || dim === secondaryCode;
            const borderHighlight = isHighlight ? "font-extrabold text-slate-900" : "font-medium text-slate-600";

            barsHtml += `
                <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs ${borderHighlight}">
                        <span>${name}</span>
                        <span class="font-extrabold">${pct}%</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div class="${barBg} h-2.5 rounded-full transition-all duration-700" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }

        // Render Strengths
        let strengthsHtml = "";
        archetype.strengths.forEach(s => {
            strengthsHtml += `
                <li class="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                    <i class="fa-solid fa-circle-check text-emerald-500 mt-1 shrink-0"></i>
                    <span>${escapeHtml(s)}</span>
                </li>
            `;
        });

        // Render Major Cards & University Benchmark Recommendations
        let majorBlocksHtml = "";
        matchedSchoolsByMajor.forEach((item, idx) => {
            const group = item.group;
            const unis = item.universities;

            let uniCardsHtml = "";
            if (unis.length === 0) {
                uniCardsHtml = `
                    <div class="col-span-full py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Chưa tìm thấy trường nào có mức điểm phù hợp với bộ lọc khu vực này trong CSDL.
                    </div>
                `;
            } else {
                unis.forEach(u => {
                    let badgeHtml = "";
                    if (u.chance === "target") {
                        badgeHtml = `<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">🎯 Vừa sức (+${u.diff}đ)</span>`;
                    } else if (u.chance === "reach") {
                        badgeHtml = `<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">🌟 Mơ ước (${u.diff}đ)</span>`;
                    } else if (u.chance === "safety") {
                        badgeHtml = `<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">🛡️ An toàn (+${u.diff}đ)</span>`;
                    } else {
                        badgeHtml = `<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">Điểm chuẩn: ${u.cutoff_score_text}</span>`;
                    }

                    uniCardsHtml += `
                        <div class="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between gap-2.5">
                            <div>
                                <div class="flex items-center justify-between gap-1 mb-1">
                                    <span class="font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">${escapeHtml(u.university_code)}</span>
                                    ${badgeHtml}
                                </div>
                                <h5 class="font-extrabold text-sm text-slate-800 line-clamp-1" title="${escapeHtml(u.university_name)}">${escapeHtml(u.university_name)}</h5>
                                <div class="text-xs text-slate-600 line-clamp-1 mt-0.5">${escapeHtml(u.major_name)}</div>
                            </div>
                            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                <span class="font-extrabold text-slate-900">Điểm: <span class="text-amber-600">${u.cutoff_score_text}</span></span>
                                <button onclick="window.jumpToUniversityBenchmark('${escapeHtml(u.university_code)}', '${escapeHtml(u.major_name)}', '${examType}')"
                                        class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white font-bold text-[11px] text-slate-700 transition-all flex items-center gap-1">
                                    <span>Tra cứu</span>
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
            }

            majorBlocksHtml += `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                                #${idx + 1}
                            </div>
                            <div>
                                <h4 class="text-base sm:text-lg font-extrabold text-slate-900">${escapeHtml(group.name)}</h4>
                                <p class="text-xs text-slate-500">${escapeHtml(group.reason)}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-xs">
                                <i class="fa-solid fa-fire text-amber-500"></i> ${group.match}% Phù Hợp
                            </span>
                        </div>
                    </div>

                    <div class="text-xs text-slate-600 flex items-center gap-2">
                        <i class="fa-solid fa-briefcase text-slate-400"></i>
                        <span><strong>Vị trí tiêu biểu:</strong> ${escapeHtml(group.careers)}</span>
                    </div>

                    <!-- Danh sách các trường đào tạo phù hợp -->
                    <div class="space-y-2 pt-2">
                        <div class="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span>Top trường đào tạo trong CSDL (${unis.length} trường gợi ý):</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            ${uniCardsHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        careerResultsCard.innerHTML = `
            <!-- BANNER TỔNG QUAN HOLLAND CODE -->
            <div class="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div class="space-y-3 max-w-2xl text-center md:text-left">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-yellow-100">
                        <i class="fa-solid fa-certificate"></i> Mã Tính Cách Holland Của Bạn: <span class="font-extrabold text-white text-sm">${hollandCode}</span>
                    </div>
                    <h3 class="text-2xl sm:text-3xl font-extrabold tracking-tight">${escapeHtml(archetype.title)}</h3>
                    <p class="text-xs sm:text-sm text-orange-100 leading-relaxed">${escapeHtml(archetype.subtitle)}</p>
                </div>
                <div class="shrink-0 flex flex-col sm:flex-row gap-3">
                    <button onclick="window.printCareerReport()"
                            class="px-4 py-2.5 rounded-xl bg-white text-orange-700 font-bold text-xs sm:text-sm shadow-md hover:bg-orange-50 flex items-center justify-center gap-2 transition-all">
                        <i class="fa-solid fa-print"></i> In / Xuất Báo Cáo
                    </button>
                    <button onclick="window.resetCareerQuizFromUI()"
                            class="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm border border-white/20 flex items-center justify-center gap-2 transition-all">
                        <i class="fa-solid fa-rotate-left"></i> Làm Lại Trắc Nghiệm
                    </button>
                </div>
            </div>

            <!-- 2 CỘT: BIỂU ĐỒ RIASEC & PHÂN TÍCH CHUYÊN SÂU -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Cột 1: Biểu đồ RIASEC -->
                <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <i class="fa-solid fa-chart-pie text-amber-500 text-lg"></i>
                        <h4 class="font-extrabold text-slate-800 text-base">Phân Bổ Thiên Hướng RIASEC</h4>
                    </div>
                    <div class="space-y-3">
                        ${barsHtml}
                    </div>
                    <p class="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">
                        * Điểm số càng cao phản ánh mức độ quan tâm và năng lượng bạn sẵn sàng đầu tư cho nhóm nghề nghiệp đó.
                    </p>
                </div>

                <!-- Cột 2: Điểm mạnh cốt lõi & Môi trường lý tưởng -->
                <div class="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div class="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <i class="fa-solid fa-lightbulb text-amber-500 text-lg"></i>
                        <h4 class="font-extrabold text-slate-800 text-base">Chân Dung Năng Lực & Phong Cách Làm Việc</h4>
                    </div>
                    <div>
                        <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Thế mạnh cá nhân nổi trội:</h5>
                        <ul class="space-y-2">
                            ${strengthsHtml}
                        </ul>
                    </div>
                    <div class="pt-2 border-t border-slate-100">
                        <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Môi trường làm việc thăng hoa:</h5>
                        <p class="text-xs sm:text-sm text-slate-700 bg-amber-50/50 p-3 rounded-xl border border-amber-200/50 flex items-start gap-2.5">
                            <i class="fa-solid fa-building text-amber-600 mt-0.5 shrink-0"></i>
                            <span>${escapeHtml(archetype.environment)}</span>
                        </p>
                    </div>
                </div>
            </div>

            <!-- KHU VỰC TOP NGÀNH HỌC & TRƯỜNG ĐẠI HỌC TƯƠNG THÍCH -->
            <div class="space-y-4">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div class="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                        <i class="fa-solid fa-graduation-cap text-amber-500"></i>
                        <span>Top Nhóm Ngành Học & Trường Đại Học Đề Xuất Cho Bạn:</span>
                    </div>
                    ${userScore !== null ? `<span class="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">Điểm của bạn: ${userScore} (${examType.toUpperCase()})</span>` : ''}
                </div>
                <div class="space-y-5">
                    ${majorBlocksHtml}
                </div>
            </div>
        `;
    }

    // Tiện ích chuyển tab và tìm kiếm nhanh khi bấm từ kết quả hướng nghiệp
    window.jumpToUniversityBenchmark = function(uniCode, majorName, examType) {
        if (examType === "tsa" || examType === "hsa") {
            setActiveTab("others");
            if (selectOtherUniversity) {
                selectOtherUniversity.value = uniCode;
            }
            if (selectOtherMethodType) {
                selectOtherMethodType.value = examType;
            }
            handleOthersAnalysis();
            const el = document.getElementById("others-schools-container");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            setActiveTab("thpt");
            if (selectThptUniversity) {
                selectThptUniversity.value = uniCode;
            }
            if (filterThptKeyword) {
                filterThptKeyword.value = majorName.split(" ")[0] || "";
            }
            handleThptAnalysis();
            const el = document.getElementById("thpt-schools-container");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    window.resetCareerQuizFromUI = function() {
        resetCareerQuiz();
    };

    window.printCareerReport = function() {
        window.print();
    };

    function escapeHtml(text) {
        if (!text) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
