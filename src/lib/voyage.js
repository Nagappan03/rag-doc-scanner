export async function embedText(texts) {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
            input: texts,
            model: 'voyage-3',
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Voyage AI error: ${error}`)
    }

    const data = await response.json()

    // Return embeddings in the same order as input
    return data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding)
}