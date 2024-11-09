import { Untie, type UntiePayload, defineUntiedFunction } from "."
import { test, expect } from 'vitest'


const createUnties = () => {
  const receiver = new Untie({
    receiver: true,
    remoteMode: true,
    secret: 'secret',
  })


  const sender = new Untie({
    receiver: false,
    remoteMode: true,
    secret: 'secret',
    transporter: {
      send: (payload: UntiePayload) => {
        return receiver.invoke(payload)
      }
    }
  })

  const wrapFunction = <T>(fn: T) => {

    defineUntiedFunction(receiver, fn, {
      key: 'myFunctionHybrid'
    })

    return defineUntiedFunction(sender, () => { /** do nothing */ }, {
      key: 'myFunctionHybrid'
    }) as T
  }

  return { sender, receiver, wrapFunction }
}

test("validate", async () => {

  const { wrapFunction } = createUnties()

  const myFunctionRemote = wrapFunction(async (a: number, b: number) => {
    return a + b
  })

  const result = await myFunctionRemote(1, 2)

  expect(result).toBe(3)
})

test("error", async () => {

  const { wrapFunction } = createUnties()

  const myFunctionRemote = wrapFunction(async (helloWorld: {
    message: string,
    name: string,
    age: bigint
  }) => {
    return `${helloWorld.message}! Meu nome é ${helloWorld.name}. Eu tenho ${helloWorld.age} anos`
  })


  expect(() => myFunctionRemote({
    message: 'Hello world',
    name: 'Brendon',
    age: BigInt(22)
  })).rejects.toThrowError('Arguments are not safely serializable')
})