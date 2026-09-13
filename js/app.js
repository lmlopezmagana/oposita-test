import { CONFIG } from "./config.js";
import { loadTopics, generateTest } from "./questions.js";
import { formatTime, escapeHtml } from "./utils.js";
import {
    saveTestResult,
    getHistory,
    clearHistory,
    getStatistics,
    saveActiveTest,
    getActiveTest,
    clearActiveTest
} from "./storage.js";

let topics = [];
let questions = [];
let answers = [];
let currentQuestion = 0;
let officialMode = false;
let timerId = null;
let remainingSeconds = 0;
let examEndsAt = null;
let finishing = false;

const resumeScreen = document.querySelector("#resume-screen");
const configScreen = document.querySelector("#config-screen");
const testScreen = document.querySelector("#test-screen");
const resultsScreen = document.querySelector("#results-screen");
const historyScreen = document.querySelector("#history-screen");
const statisticsScreen = document.querySelector("#statistics-screen");

const topicsContainer = document.querySelector("#topics-container");
const questionContainer = document.querySelector("#question-container");
const questionGrid = document.querySelector("#question-grid");
const questionCount = document.querySelector("#question-count");
const configError = document.querySelector("#config-error");
const timerContainer = document.querySelector("#timer-container");
const timerElement = document.querySelector("#timer");
const progress = document.querySelector("#progress");

async function init() {
    try {
        topics = await loadTopics();
        renderTopics();

        const activeTest = getActiveTest();

        if (activeTest) {
            showResumeOption(activeTest);
        } else {
            showScreen(configScreen);
        }
    } catch (error) {
        showScreen(configScreen);
        showConfigError(error.message);
    }
}

function showScreen(screen) {
    [resumeScreen, configScreen, testScreen, resultsScreen, historyScreen, statisticsScreen]
        .forEach(item => item.classList.add("hidden"));

    screen.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector("#nav-test").addEventListener("click", () => {
    const active = getActiveTest();
    if (active) showResumeOption(active);
    else showScreen(configScreen);
});

document.querySelector("#nav-history").addEventListener("click", () => {
    renderHistory();
    showScreen(historyScreen);
});

document.querySelector("#nav-statistics").addEventListener("click", () => {
    renderStatistics();
    showScreen(statisticsScreen);
});

function renderTopics() {
    topicsContainer.innerHTML = "";

    const common = topics.filter(topic => topic.bloque === "comun");
    const specific = topics.filter(topic => topic.bloque === "especifico");

    topicsContainer.appendChild(createTopicBlock("Materias comunes", common));
    topicsContainer.appendChild(createTopicBlock("Materias específicas", specific));
}

function createTopicBlock(title, topicList) {
    const section = document.createElement("section");
    section.className = "topic-block";

    const heading = document.createElement("h4");
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "topic-grid";

    topicList.forEach(topic => {
        const label = document.createElement("label");
        label.className = "topic";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = "topic";
        input.value = String(topic.id);
        input.checked = true;

        const span = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = `Tema ${topic.id}`;
        span.append(strong, document.createTextNode(topic.titulo));

        label.append(input, span);
        grid.appendChild(label);
    });

    section.appendChild(grid);
    return section;
}

function setTopics(predicate) {
    document.querySelectorAll('input[name="topic"]').forEach(input => {
        input.checked = predicate(Number(input.value));
    });
}

document.querySelector("#select-all").addEventListener("click", () => setTopics(() => true));
document.querySelector("#select-none").addEventListener("click", () => setTopics(() => false));
document.querySelector("#select-common").addEventListener("click", () => setTopics(id => id <= 15));
document.querySelector("#select-specific").addEventListener("click", () => setTopics(id => id >= 16));

document.querySelector("#official-mode").addEventListener("click", () => {
    questionCount.value = CONFIG.EXAMEN_OFICIAL.preguntas;
    setTopics(() => true);
    officialMode = true;
    document.querySelector("#official-mode").classList.add("active");
});

function disableOfficialMode() {
    officialMode = false;
    document.querySelector("#official-mode").classList.remove("active");
}

questionCount.addEventListener("input", disableOfficialMode);
topicsContainer.addEventListener("change", disableOfficialMode);

document.querySelector("#start-test").addEventListener("click", startTest);

async function startTest() {
    hideConfigError();

    const selectedTopics = [...document.querySelectorAll('input[name="topic"]:checked')]
        .map(input => Number(input.value));

    if (selectedTopics.length === 0) {
        showConfigError("Selecciona al menos un tema.");
        return;
    }

    const total = Number(questionCount.value);

    if (
        !Number.isInteger(total) ||
        total < CONFIG.TEST.preguntasMinimas ||
        total > CONFIG.TEST.preguntasMaximas
    ) {
        showConfigError("Número de preguntas no válido.");
        return;
    }

    try {
        questions = await generateTest(selectedTopics, total);
    } catch (error) {
        showConfigError(error.message);
        return;
    }

    answers = new Array(questions.length).fill(null);
    currentQuestion = 0;
    finishing = false;

    showScreen(testScreen);

    if (officialMode) {
        startTimer(CONFIG.EXAMEN_OFICIAL.minutos);
    } else {
        stopTimer();
        timerContainer.classList.add("hidden");
        remainingSeconds = 0;
        examEndsAt = null;
    }

    renderQuestion();
    renderQuestionGrid();
    persistActiveTest();
}

function renderQuestion() {
    const question = questions[currentQuestion];
    if (!question) return;

    progress.textContent = `Pregunta ${currentQuestion + 1} de ${questions.length}`;

    const article = document.createElement("article");
    article.className = "question-card";

    const topic = document.createElement("div");
    topic.className = "question-topic";
    topic.textContent = `Tema ${question.tema}`;

    const heading = document.createElement("h2");
    heading.textContent = question.pregunta;

    const options = document.createElement("div");
    options.className = "answers";

    question.opciones.forEach((option, index) => {
        const label = document.createElement("label");
        label.className = "answer";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "answer";
        input.value = String(index);
        input.checked = answers[currentQuestion] === index;

        input.addEventListener("change", event => {
            answers[currentQuestion] = Number(event.target.value);
            persistActiveTest();
            renderQuestionGrid();
        });

        const letter = document.createElement("span");
        letter.className = "answer-letter";
        letter.textContent = String.fromCharCode(65 + index);

        const text = document.createElement("span");
        text.textContent = option;

        label.append(input, letter, text);
        options.appendChild(label);
    });

    const clear = document.createElement("button");
    clear.id = "clear-answer";
    clear.type = "button";
    clear.className = "small";
    clear.textContent = "Dejar en blanco";
    clear.addEventListener("click", () => {
        answers[currentQuestion] = null;
        persistActiveTest();
        renderQuestion();
        renderQuestionGrid();
    });

    article.append(topic, heading, options, clear);
    questionContainer.replaceChildren(article);
}

document.querySelector("#previous-question").addEventListener("click", () => {
    if (currentQuestion > 0) {
        currentQuestion--;
        persistActiveTest();
        renderQuestion();
        renderQuestionGrid();
    }
});

document.querySelector("#next-question").addEventListener("click", () => {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        persistActiveTest();
        renderQuestion();
        renderQuestionGrid();
    }
});

function renderQuestionGrid() {
    questionGrid.innerHTML = "";

    questions.forEach((question, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = index + 1;
        button.className = "question-number";

        if (answers[index] !== null) button.classList.add("answered");
        if (index === currentQuestion) button.classList.add("current");

        button.addEventListener("click", () => {
            currentQuestion = index;
            persistActiveTest();
            renderQuestion();
            renderQuestionGrid();
        });

        questionGrid.appendChild(button);
    });
}

document.querySelector("#finish-test").addEventListener("click", () => {
    const unanswered = answers.filter(answer => answer === null).length;
    let message = "¿Deseas finalizar el test?";

    if (unanswered > 0) {
        message = `Tienes ${unanswered} preguntas sin contestar. ¿Deseas finalizar?`;
    }

    if (confirm(message)) finishTest();
});

function finishTest() {
    if (finishing || questions.length === 0) return;
    finishing = true;

    stopTimer();
    clearActiveTest();

    let correct = 0;
    let incorrect = 0;
    let blank = 0;
    const topicMap = new Map();

    questions.forEach((question, index) => {
        const answer = answers[index];

        if (!topicMap.has(question.tema)) {
            topicMap.set(question.tema, {
                topicId: question.tema,
                total: 0,
                correct: 0,
                incorrect: 0,
                blank: 0
            });
        }

        const topicResult = topicMap.get(question.tema);
        topicResult.total++;

        if (answer === null) {
            blank++;
            topicResult.blank++;
        } else if (answer === question.correcta) {
            correct++;
            topicResult.correct++;
        } else {
            incorrect++;
            topicResult.incorrect++;
        }
    });

    const net = correct - (incorrect * CONFIG.EXAMEN_OFICIAL.penalizacionError);
    const score = Number(Math.max(0, (net / questions.length) * 10).toFixed(2));

    document.querySelector("#correct-count").textContent = correct;
    document.querySelector("#incorrect-count").textContent = incorrect;
    document.querySelector("#blank-count").textContent = blank;
    document.querySelector("#score-value").textContent = score.toFixed(2);

    renderPassResult(score);
    renderReview();

    saveTestResult({
        mode: officialMode ? "official" : "custom",
        totalQuestions: questions.length,
        correct,
        incorrect,
        blank,
        score,
        passed: score >= CONFIG.EXAMEN_OFICIAL.notaAprobado,
        topics: [...new Set(questions.map(question => question.tema))],
        topicResults: [...topicMap.values()]
    });

    showScreen(resultsScreen);
    finishing = false;
}

function renderPassResult(score) {
    const container = document.querySelector("#passed-result");

    if (score >= CONFIG.EXAMEN_OFICIAL.notaAprobado) {
        container.innerHTML = '<div class="passed">✓ APROBADO</div>';
    } else {
        container.innerHTML = '<div class="failed">✗ NO APROBADO</div>';
    }
}

function renderReview() {
    const container = document.querySelector("#review-container");
    container.innerHTML = "";

    questions.forEach((question, index) => {
        const answer = answers[index];
        if (answer === question.correcta) return;

        const article = document.createElement("article");
        article.className = "review-card";

        const topic = document.createElement("div");
        topic.className = "question-topic";
        topic.textContent = `Tema ${question.tema}`;

        const title = document.createElement("h4");
        title.textContent = `Pregunta ${index + 1}`;

        const text = document.createElement("p");
        text.textContent = question.pregunta;

        const user = document.createElement("p");
        user.className = "your-answer";
        user.innerHTML = `<strong>Tu respuesta:</strong> ${escapeHtml(
            answer === null ? "Sin contestar" : question.opciones[answer]
        )}`;

        const right = document.createElement("p");
        right.className = "correct-answer";
        right.innerHTML = `<strong>Respuesta correcta:</strong> ${escapeHtml(
            question.opciones[question.correcta]
        )}`;

        article.append(topic, title, text, user, right);
        container.appendChild(article);
    });

    if (container.children.length === 0) {
        container.innerHTML = '<div class="perfect">¡Has acertado todas las preguntas!</div>';
    }
}

function renderHistory() {
    const history = getHistory();
    const container = document.querySelector("#history-container");
    container.innerHTML = "";

    if (history.length === 0) {
        container.innerHTML = '<p class="empty-message">Todavía no has realizado ningún test.</p>';
        return;
    }

    history.forEach(test => {
        const date = new Date(test.date);
        const article = document.createElement("article");
        article.className = "history-card";

        const sortedTopics = [...(test.topics ?? [])].sort((a, b) => a - b);

        article.innerHTML = `
            <div class="history-header">
                <div>
                    <strong>${test.mode === "official" ? "Simulacro oficial" : "Test personalizado"}</strong>
                    <div class="muted">${escapeHtml(date.toLocaleString("es-ES"))}</div>
                </div>
                <div class="history-score ${test.passed ? "score-pass" : "score-fail"}">
                    ${Number(test.score).toFixed(2)}
                </div>
            </div>
            <div class="history-data">
                <span>${test.totalQuestions} preguntas</span>
                <span class="correct-text">${test.correct} correctas</span>
                <span class="incorrect-text">${test.incorrect} incorrectas</span>
                <span>${test.blank} en blanco</span>
            </div>
            <div class="history-topics">Temas: ${sortedTopics.join(", ")}</div>
        `;

        container.appendChild(article);
    });
}

document.querySelector("#clear-history").addEventListener("click", () => {
    const confirmed = confirm(
        "Se eliminará todo el historial y las estadísticas. ¿Deseas continuar?"
    );

    if (!confirmed) return;
    clearHistory();
    renderHistory();
});

function renderStatistics() {
    const stats = getStatistics();
    const container = document.querySelector("#statistics-container");
    const topicContainer = document.querySelector("#topic-statistics");

    if (stats.tests === 0) {
        container.innerHTML = '<p class="empty-message">Todavía no existen estadísticas.</p>';
        topicContainer.innerHTML = "";
        return;
    }

    const successPercentage =
        stats.totalQuestions > 0 ? (stats.correct / stats.totalQuestions) * 100 : 0;

    container.innerHTML = `
        <div class="statistics-grid">
            <div class="stat-card"><strong>${stats.tests}</strong><span>Tests realizados</span></div>
            <div class="stat-card"><strong>${stats.averageScore.toFixed(2)}</strong><span>Nota media</span></div>
            <div class="stat-card"><strong>${stats.bestScore.toFixed(2)}</strong><span>Mejor nota</span></div>
            <div class="stat-card"><strong>${stats.totalQuestions}</strong><span>Preguntas realizadas</span></div>
            <div class="stat-card"><strong>${successPercentage.toFixed(1)} %</strong><span>Porcentaje de aciertos</span></div>
        </div>
    `;

    topicContainer.innerHTML = "";

    stats.topicStats.forEach(topicStats => {
        const topic = topics.find(item => item.id === topicStats.topicId);
        const article = document.createElement("article");
        article.className = "topic-stat-card";

        article.innerHTML = `
            <div class="topic-stat-header">
                <div>
                    <strong>Tema ${topicStats.topicId}</strong>
                    <div class="muted">${escapeHtml(topic?.titulo ?? "")}</div>
                </div>
                <strong>${topicStats.successRate.toFixed(1)} %</strong>
            </div>
            <div class="progress-bar">
                <div class="progress-value" style="width:${Math.max(0, Math.min(100, topicStats.successRate))}%"></div>
            </div>
            <div class="topic-stat-values">
                <span>${topicStats.total} preguntas</span>
                <span class="correct-text">${topicStats.correct} correctas</span>
                <span class="incorrect-text">${topicStats.incorrect} incorrectas</span>
                <span>${topicStats.blank} en blanco</span>
            </div>
        `;

        topicContainer.appendChild(article);
    });
}

function persistActiveTest() {
    if (questions.length === 0 || finishing) return;

    saveActiveTest({
        appVersion: CONFIG.APP_VERSION,
        questions,
        answers,
        currentQuestion,
        officialMode,
        remainingSeconds,
        examEndsAt,
        totalQuestions: questions.length
    });
}

function startTimer(minutes, restoredEndsAt = null) {
    stopTimer();
    timerContainer.classList.remove("hidden");

    examEndsAt = restoredEndsAt ?? (Date.now() + minutes * 60 * 1000);

    const tick = () => {
        remainingSeconds = Math.max(0, Math.ceil((examEndsAt - Date.now()) / 1000));
        updateTimer();

        if (remainingSeconds % 10 === 0) persistActiveTest();

        if (remainingSeconds <= 0) {
            stopTimer();
            alert("El tiempo ha finalizado.");
            finishTest();
        }
    };

    tick();
    timerId = setInterval(tick, 1000);
}

function updateTimer() {
    timerElement.textContent = formatTime(remainingSeconds);
}

function stopTimer() {
    if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
    }
}

function showResumeOption(activeTest) {
    const answered = activeTest.answers.filter(answer => answer !== null).length;
    const total = activeTest.questions.length;
    const pending = total - answered;
    const topicsUsed = [...new Set(activeTest.questions.map(question => question.tema))]
        .sort((a, b) => a - b);

    let timeInfo = "";
    if (activeTest.officialMode && activeTest.examEndsAt) {
        const secondsLeft = Math.max(0, Math.ceil((activeTest.examEndsAt - Date.now()) / 1000));
        timeInfo = `<p><strong>Tiempo restante:</strong> ${escapeHtml(formatTime(secondsLeft))}</p>`;
    }

    document.querySelector("#resume-info").innerHTML = `
        <div class="resume-summary">
            <p><strong>Tipo:</strong> ${activeTest.officialMode ? "Simulacro oficial" : "Test personalizado"}</p>
            <p><strong>Preguntas:</strong> ${total}</p>
            <p><strong>Contestadas:</strong> ${answered}</p>
            <p><strong>Pendientes:</strong> ${pending}</p>
            <p><strong>Temas:</strong> ${topicsUsed.join(", ")}</p>
            ${timeInfo}
        </div>
    `;

    showScreen(resumeScreen);
}

document.querySelector("#resume-test").addEventListener("click", () => {
    const activeTest = getActiveTest();

    if (!activeTest) {
        showScreen(configScreen);
        return;
    }

    questions = activeTest.questions;
    answers = activeTest.answers;
    currentQuestion = Math.min(
        Math.max(0, activeTest.currentQuestion ?? 0),
        Math.max(0, questions.length - 1)
    );
    officialMode = Boolean(activeTest.officialMode);
    examEndsAt = activeTest.examEndsAt ?? null;
    remainingSeconds = activeTest.remainingSeconds ?? 0;
    finishing = false;

    showScreen(testScreen);

    if (officialMode) {
        if (examEndsAt && examEndsAt <= Date.now()) {
            alert("El tiempo del simulacro ha finalizado. Se corregirá con las respuestas guardadas.");
            finishTest();
            return;
        }

        startTimer(CONFIG.EXAMEN_OFICIAL.minutos, examEndsAt);
    } else {
        stopTimer();
        timerContainer.classList.add("hidden");
    }

    renderQuestion();
    renderQuestionGrid();
});

document.querySelector("#discard-test").addEventListener("click", () => {
    const confirmed = confirm("El test pendiente se eliminará. ¿Deseas descartarlo?");
    if (!confirmed) return;

    clearActiveTest();
    questions = [];
    answers = [];
    currentQuestion = 0;
    remainingSeconds = 0;
    examEndsAt = null;
    officialMode = false;
    showScreen(configScreen);
});

document.querySelector("#new-test").addEventListener("click", () => {
    questions = [];
    answers = [];
    currentQuestion = 0;
    officialMode = false;
    examEndsAt = null;
    remainingSeconds = 0;
    showScreen(configScreen);
});

function showConfigError(message) {
    configError.textContent = message;
    configError.classList.remove("hidden");
}

function hideConfigError() {
    configError.classList.add("hidden");
}

window.addEventListener("beforeunload", () => {
    persistActiveTest();
});

init();
