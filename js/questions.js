import {
    shuffle
} from "./utils.js";


// ============================================================
// RUTAS
// ============================================================

function getTopicFilePath(
    topicId
) {

    return (
        "./data/tema-" +
        String(topicId)
            .padStart(2, "0") +
        ".json"
    );
}


// ============================================================
// COMPROBAR DISPONIBILIDAD
// ============================================================

/**
 * Comprueba si existe el fichero JSON correspondiente
 * a un tema.
 *
 * Ejemplo:
 *
 * Tema 7
 * -> ./data/tema-07.json
 *
 * Si existe:
 *      true
 *
 * Si devuelve 404:
 *      false
 */
async function topicFileExists(
    topicId
) {

    const file =
        getTopicFilePath(
            topicId
        );


    try {

        /*
         * HEAD evita descargar el fichero completo.
         *
         * GitHub Pages admite este tipo de petición.
         */

        const response =
            await fetch(
                file,
                {
                    method: "HEAD",

                    /*
                     * Evitamos que el navegador
                     * conserve respuestas 404 antiguas.
                     */
                    cache: "no-store"
                }
            );


        if (response.ok) {

            return true;
        }


        /*
         * Algunos servidores web muy simples
         * podrían no permitir HEAD.
         *
         * En ese caso intentamos GET.
         */

        if (
            response.status === 405 ||
            response.status === 501
        ) {

            const fallback =
                await fetch(
                    file,
                    {
                        method: "GET",
                        cache: "no-store"
                    }
                );


            return fallback.ok;
        }


        return false;

    } catch (error) {

        /*
         * Ante un problema de red tratamos
         * el tema como no disponible.
         */

        console.warn(
            `No se ha podido comprobar el Tema ${topicId}:`,
            error
        );


        return false;
    }
}


// ============================================================
// CARGAR CATÁLOGO DE TEMAS
// ============================================================

export async function loadTopics() {

    const response =
        await fetch(
            "./data/temas.json",
            {
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            "No se ha podido cargar el listado de temas."
        );
    }


    const topics =
        await response.json();


    if (!Array.isArray(topics)) {

        throw new Error(
            "El fichero temas.json no contiene un listado válido."
        );
    }


    /*
     * Comprobamos en paralelo los 60 ficheros.
     *
     * Esto es mucho más rápido que hacerlo
     * secuencialmente.
     */

    const topicsWithAvailability =
        await Promise.all(

            topics.map(
                async topic => {

                    const available =
                        await topicFileExists(
                            topic.id
                        );


                    return {

                        ...topic,

                        available

                    };
                }
            )
        );


    return topicsWithAvailability;
}


// ============================================================
// CARGAR PREGUNTAS DE UN TEMA
// ============================================================

export async function loadQuestions(
    topicId
) {

    const file =
        getTopicFilePath(
            topicId
        );


    const response =
        await fetch(
            file,
            {
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            `No se ha podido cargar el Tema ${topicId}.`
        );
    }


    const data =
        await response.json();


    if (
        !Array.isArray(
            data.preguntas
        )
    ) {

        throw new Error(
            `El fichero del Tema ${topicId} ` +
            "no contiene un array de preguntas válido."
        );
    }


    if (
        data.preguntas.length === 0
    ) {

        throw new Error(
            `El Tema ${topicId} no contiene preguntas.`
        );
    }


    return data.preguntas.map(
        question => ({

            ...question,

            tema:
                topicId

        })
    );
}


// ============================================================
// BARAJAR RESPUESTAS
// ============================================================

function shuffleAnswers(
    question
) {

    const answers =
        question.opciones.map(
            (
                text,
                index
            ) => ({

                text,

                correct:
                    index ===
                    question.correcta

            })
        );


    const shuffled =
        shuffle(
            answers
        );


    return {

        ...question,

        opciones:
            shuffled.map(
                answer =>
                    answer.text
            ),

        correcta:
            shuffled.findIndex(
                answer =>
                    answer.correct
            )
    };
}


// ============================================================
// GENERAR TEST
// ============================================================

export async function generateTest(
    selectedTopics,
    totalQuestions
) {

    if (
        selectedTopics.length === 0
    ) {

        throw new Error(
            "Debes seleccionar al menos un tema."
        );
    }


    const topicPools =
        new Map();


    /*
     * Cargamos los bancos de los temas seleccionados.
     */

    await Promise.all(

        selectedTopics.map(
            async topicId => {

                const questions =
                    await loadQuestions(
                        topicId
                    );


                topicPools.set(
                    topicId,
                    shuffle(
                        questions
                    )
                );
            }
        )
    );


    /*
     * Número total de preguntas disponibles.
     */

    const availableQuestions =
        [
            ...topicPools.values()
        ]
        .reduce(
            (
                total,
                questions
            ) =>
                total +
                questions.length,
            0
        );


    if (
        availableQuestions <
        totalQuestions
    ) {

        throw new Error(

            `Sólo existen ${availableQuestions} ` +
            "preguntas disponibles para los " +
            "temas seleccionados."

        );
    }


    // ========================================================
    // REPARTO INICIAL
    // ========================================================

    const topicOrder =
        shuffle(
            selectedTopics
        );


    const base =
        Math.floor(
            totalQuestions /
            selectedTopics.length
        );


    let remainder =
        totalQuestions %
        selectedTopics.length;


    const allocation =
        new Map();


    topicOrder.forEach(
        topicId => {

            allocation.set(

                topicId,

                base +
                (
                    remainder > 0
                        ? 1
                        : 0
                )
            );


            if (
                remainder > 0
            ) {

                remainder--;
            }
        }
    );


    // ========================================================
    // DETECTAR DÉFICIT
    // ========================================================

    let missing = 0;


    for (
        const topicId
        of selectedTopics
    ) {

        const available =
            topicPools
                .get(topicId)
                .length;


        const requested =
            allocation
                .get(topicId);


        if (
            requested >
            available
        ) {

            missing +=
                requested -
                available;


            allocation.set(
                topicId,
                available
            );
        }
    }


    // ========================================================
    // REDISTRIBUIR DÉFICIT
    // ========================================================

    while (
        missing > 0
    ) {

        /*
         * Elegimos primero los temas que actualmente
         * tienen menos preguntas asignadas.
         */

        const candidates =
            shuffle(
                selectedTopics
            )
            .filter(
                topicId => {

                    const allocated =
                        allocation
                            .get(topicId);


                    const available =
                        topicPools
                            .get(topicId)
                            .length;


                    return (
                        allocated <
                        available
                    );
                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    allocation.get(a) -
                    allocation.get(b)
            );


        if (
            candidates.length === 0
        ) {

            throw new Error(
                "No existen suficientes preguntas disponibles."
            );
        }


        const minAllocation =
            allocation.get(
                candidates[0]
            );


        const lowest =
            candidates.filter(
                topicId =>
                    allocation.get(
                        topicId
                    ) ===
                    minAllocation
            );


        for (
            const topicId
            of lowest
        ) {

            if (
                missing === 0
            ) {
                break;
            }


            allocation.set(

                topicId,

                allocation.get(
                    topicId
                ) + 1
            );


            missing--;
        }
    }


    // ========================================================
    // EXTRAER PREGUNTAS
    // ========================================================

    const test = [];


    for (
        const topicId
        of selectedTopics
    ) {

        const count =
            allocation.get(
                topicId
            );


        const pool =
            topicPools.get(
                topicId
            );


        test.push(

            ...pool
                .slice(
                    0,
                    count
                )
                .map(
                    shuffleAnswers
                )

        );
    }


    /*
     * Finalmente barajamos todo el test para que
     * las preguntas de un tema no aparezcan juntas.
     */

    return shuffle(
        test
    );
}