export const fetchHyGraph = async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
    const response = await fetch(import.meta.env.HYGRAPH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables, 
      }),
    });
  
    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }
  
    const json = await response.json();
  
    if (json.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
  
    return json.data;
  };

export default fetchHyGraph