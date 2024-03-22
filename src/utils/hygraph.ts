import type { THyGraphResponse } from "../models/model";

const fetchHyGraph = async<K, T>(query: string): Promise<THyGraphResponse<K, T>> => {
    const request = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query,
        }),
    };

    const response = await fetch(import.meta.env.HYGRAPH_ENDPOINT, request);
    const json = await response.json();
    return json;
}

export { fetchHyGraph }