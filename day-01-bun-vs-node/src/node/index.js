import http from "http";
const todos = [];
const start = performance.now();
console.log("server starting - ", start);
const server = http.createServer(async (req, res) => {
    if (req.url === "/health") {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: "ok" }));
        return res;
    }
    if (req.url === "/todos") {
        if (req.method === "GET") {
            res.statusCode = 200;
            res.end(JSON.stringify({ todos }));
            return res;
        }
        if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk.toString();
            });
            req.on("end", () => {
                const title = JSON.parse(body).title;
                let newId = todos[todos.length - 1]?.id ?? 0;
                newId++;
                todos.push({
                    id: newId,
                    title,
                });
                res.statusCode = 200;
                res.end(JSON.stringify({ id: newId, title }));
                return res;
            });
        }
    }
});
server.listen(3001, () => {
    console.log("Server running at http://localhost:3001/");
    const end = performance.now();
    console.log("server started - ", end);
    console.log(`total time: ${end - start} ms`);
});
