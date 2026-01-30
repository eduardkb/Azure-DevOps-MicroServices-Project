export default async function (context, req) {
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      message: "Function App working normally!"
    }
  };
}
