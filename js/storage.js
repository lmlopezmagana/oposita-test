const HISTORY_KEY = "oposiciones-ts-mairena-history-v1";
const ACTIVE_TEST_KEY = "oposiciones-ts-mairena-active-test-v1";

function parseArray(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error(`Error leyendo ${key}:`, error);
        return [];
    }
}

export function getHistory() {
    return parseArray(HISTORY_KEY);
}

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function saveTestResult(result) {
    const history = getHistory();
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const entry = {
        id,
        date: new Date().toISOString(),
        ...result
    };
    history.unshift(entry);
    saveHistory(history);
    return entry;
}

export function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
}

export function saveActiveTest(activeTest) {
    try {
        localStorage.setItem(
            ACTIVE_TEST_KEY,
            JSON.stringify({
                ...activeTest,
                savedAt: new Date().toISOString()
            })
        );
    } catch (error) {
        console.error("No se ha podido guardar el test en curso:", error);
    }
}

export function getActiveTest() {
    try {
        const raw = localStorage.getItem(ACTIVE_TEST_KEY);
        if (!raw) return null;

        const activeTest = JSON.parse(raw);

        if (
            !activeTest ||
            !Array.isArray(activeTest.questions) ||
            !Array.isArray(activeTest.answers) ||
            activeTest.questions.length !== activeTest.answers.length
        ) {
            clearActiveTest();
            return null;
        }

        return activeTest;
    } catch (error) {
        console.error("Error leyendo el test en curso:", error);
        clearActiveTest();
        return null;
    }
}

export function clearActiveTest() {
    localStorage.removeItem(ACTIVE_TEST_KEY);
}

export function getStatistics() {
    const history = getHistory();

    if (history.length === 0) {
        return {
            tests: 0,
            averageScore: 0,
            bestScore: 0,
            totalQuestions: 0,
            correct: 0,
            incorrect: 0,
            blank: 0,
            topicStats: []
        };
    }

    let totalScore = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalBlank = 0;
    const topics = new Map();

    history.forEach(test => {
        totalScore += Number(test.score) || 0;
        totalQuestions += Number(test.totalQuestions) || 0;
        totalCorrect += Number(test.correct) || 0;
        totalIncorrect += Number(test.incorrect) || 0;
        totalBlank += Number(test.blank) || 0;

        if (Array.isArray(test.topicResults)) {
            test.topicResults.forEach(topic => {
                if (!topics.has(topic.topicId)) {
                    topics.set(topic.topicId, {
                        topicId: topic.topicId,
                        total: 0,
                        correct: 0,
                        incorrect: 0,
                        blank: 0
                    });
                }

                const stats = topics.get(topic.topicId);
                stats.total += topic.total;
                stats.correct += topic.correct;
                stats.incorrect += topic.incorrect;
                stats.blank += topic.blank;
            });
        }
    });

    const topicStats = [...topics.values()]
        .map(topic => ({
            ...topic,
            successRate: topic.total > 0 ? (topic.correct / topic.total) * 100 : 0
        }))
        .sort((a, b) => a.successRate - b.successRate);

    return {
        tests: history.length,
        averageScore: totalScore / history.length,
        bestScore: Math.max(...history.map(test => Number(test.score) || 0)),
        totalQuestions,
        correct: totalCorrect,
        incorrect: totalIncorrect,
        blank: totalBlank,
        topicStats
    };
}
