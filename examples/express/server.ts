import { NodeFetchTransporter, Untie } from "../../index";
import type { Request, Response } from "express";
import express from "express";

const untie = new Untie({
  receiver: process.env.NODE_ENV === 'production',
  remoteMode: process.env.REMOTE_ENABLED === 'true',
  secret: process.env.UNTIE_SECRET,
  transporter: new NodeFetchTransporter({
    url: "http://localhost:3000/untie",
    method: 'POST',
  }),
});

function untieCreateExpressRouteHandler(untie: Untie) {
  return async (req: Request, res: Response) => {
    const result = await untie.injest(req.headers.authorization, req.body);
    res.json(result);
  }
}

const myFunctionSum = untie.fn(async (a: number, b: number) => {
  console.log('Sum function called here');
  return a + b;
})

const app = express()

app.use(express.json())
app.post('/untie', untieCreateExpressRouteHandler(untie));
app.get('/sum', async (req, res) => {
  console.log("invoked here")
  const result = await myFunctionSum(1, 2);
  res.send(JSON.stringify(result));
})
app.get('/', (req, res) => {
  res.send('Hello World')
})

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});