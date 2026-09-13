import { shuffle } from "./utils.js";

export async function loadTopics() {
    const response = await fetch("./data/temas.json");
    if (!response.ok) throw new Error("No se ha podido cargar el listado de temas.");
    return response.json();
}

export async function loadQuestions(topicId) {
    const file = `./data/tema-${String(topicId).padStart(2, "0")}.json`;
    const response = await fetch(file);
    if (!response.ok) throw new Error(`No se ha podido cargar el tema ${topicId}.`);

    const data = await response.json();

    if (!Array.isArray(data.preguntas)) {
        throw new Error(`El fichero del tema ${topicId} no contiene un array de preguntas válido.`);
    }

    return data.preguntas.map(question => ({
        ...question,
        tema: topicId
    }));
}

function shuffleAnswers(question) {
    const answers = question.opciones.map((text, index) => ({
        text,
        correct: index === question.correcta
    }));

    const shuffled = shuffle(answers);

    return {
        ...question,
        opciones: shuffled.map(answer => answer.text),
        correcta: shuffled.findIndex(answer => answer.correct)
    };
}

export async function generateTest(selectedTopics, totalQuestions) {
    if (selectedTopics.length === 0) {
        throw new Error("Debes seleccionar al menos un tema.");
    }

    const topicPools = new Map();

    await Promise.all(
        selectedTopics.map(async topicId => {
            const questions = await loadQuestions(topicId);
            topicPools.set(topicId, shuffle(questions));
        })
    );

    const availableQuestions = [...topicPools.values()]
        .reduce((total, questions) => total + questions.length, 0);

    if (availableQuestions < totalQuestions) {
        throw new Error(
            `Sólo existen ${availableQuestions} preguntas disponibles para los temas seleccionados.`
        );
    }

    const topicOrder = shuffle(selectedTopics);
    const base = Math.floor(totalQuestions / selectedTopics.length);
    let remainder = totalQuestions % selectedTopics.length;
    const allocation = new Map();

    topicOrder.forEach(topicId => {
        allocation.set(topicId, base + (remainder > 0 ? 1 : 0));
        if (remainder > 0) remainder--;
    });

    let missing = 0;

    for (const topicId of selectedTopics) {
        const available = topicPools.get(topicId).length;
        const requested = allocation.get(topicId);

        if (requested > available) {
            missing += requested - available;
            allocation.set(topicId, available);
        }
    }

    while (missing > 0) {
        // Prioritize topics with the smallest current allocation to keep distribution normalized.
        const candidates = shuffle(selectedTopics)
            .filter(topicId => allocation.get(topicId) < topicPools.get(topicId).length)
            .sort((a, b) => allocation.get(a) - allocation.get(b));

        if (candidates.length === 0) {
            throw new Error("No existen suficientes preguntas disponibles.");
        }

        const minAllocation = allocation.get(candidates[0]);
        const lowest = candidates.filter(id => allocation.get(id) === minAllocation);

        for (const topicId of lowest) {
            if (missing === 0) break;
            allocation.set(topicId, allocation.get(topicId) + 1);
            missing--;
        }
    }

    const test = [];

    for (const topicId of selectedTopics) {
        const count = allocation.get(topicId);
        const pool = topicPools.get(topicId);

        test.push(
            ...pool
                .slice(0, count)
                .map(shuffleAnswers)
        );
    }

    return shuffle(test);
}
