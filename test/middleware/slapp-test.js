import { expect } from 'chai'
import { stub } from 'sinon'
import SlappMiddleware, {
  applyActionPlugins,
  validBlockRequestTypes,
  registeredActionsHandler,
} from '../../src/middleware/slapp'

describe('Slapp middleware block requests handler', () => {
  let validRequestHandlers
  let middleware
  let next

  beforeEach(() => {
    validRequestHandlers = validBlockRequestTypes.reduce((acc, requestType) => {
      acc[requestType] = stub()

      return acc
    }, {})

    middleware = SlappMiddleware(validRequestHandlers)
    next = stub()
  })

  validBlockRequestTypes.map(requestType =>
    it('should handle supported type -actions', async () => {
      const message = {
        body: {
          type: requestType,
        },
      }

      await middleware(message, next)
      expect(validRequestHandlers[requestType].callCount).eql(1)
      expect(validRequestHandlers[requestType].calledWith(message))
      expect(next.callCount).eql(0)
    }))

  it('should ignore other types', async () => {
    const message = {
      body: {
        type: 'some-other-type',
      },
    }
    await middleware(message, next)

    expect(next.callCount).eql(1)
    Object.values(validRequestHandlers).forEach(handler =>
      expect(handler.callCount).eql(0))
  })

  it('should call next if some supported type is not available', async () => {
    const notFullHandlers = {
      ...validRequestHandlers[validBlockRequestTypes[0]],
    }

    middleware = SlappMiddleware(notFullHandlers)

    const message = {
      body: {
        type: validBlockRequestTypes[1],
      },
    }
    await middleware(message, next)

    expect(next.callCount).eql(1)
    Object.values(validRequestHandlers).forEach(handler =>
      expect(handler.callCount).eql(0))
  })
  it('should not fail on wrong type passed as handlers', async () => {
    await middleware('some string', next)
    expect(next.callCount).eql(1)
    Object.values(validRequestHandlers).forEach(handler =>
      expect(handler.callCount).eql(0))
  })
})

describe('actions handlers', () => {
  it('should apply registered plugins', async () => {
    const expectedContext = {
      pluginA: 'a',
      pluginB: 'b',
    }
    const pluginA = stub()
    const pluginB = stub()

    pluginA.returns({
      pluginA: 'a',
    })

    pluginB.returns({
      pluginB: 'b',
    })

    const actionPlugins = [
      pluginA,
      pluginB,
    ]

    const message = {}
    expect(await applyActionPlugins(actionPlugins, message)).deep.eql(expectedContext)
  })

  it('should act on registered action handler', async () => {
    const expectedResponse = {
      custom: 'message',
    }

    const myActionHandler = stub()
    myActionHandler.returns(expectedResponse)

    const pluginA = stub()
    pluginA.returns({
      pluginA: 'a',
    })

    const actionPlugins = [
      pluginA,
    ]
    const message = {
      body: {
        action_id: 'my-action',
        block_id: 'block-23',
      },
      respond: stub(),
    }

    const actionHandlers = registeredActionsHandler({
      'my-action': myActionHandler,
    }, actionPlugins)

    await actionHandlers(message)
    expect(myActionHandler.firstCall.args).deep.eql([
      message, {
        actionId: message.body.action_id,
        blockId: message.body.block_id,
        pluginA: 'a',
      }])

    expect(myActionHandler.callCount).eql(1)
    expect(message.respond.firstCall.args).deep.eql([{
      ...expectedResponse,
    }])
  })
  it('should respond with empty response if no action handler is available', async () => {
    const actionHandlers = registeredActionsHandler()
    const message = {
      body: {
        action_id: 'my-action',
        block_id: 'block-23',
      },
      respond: stub(),
    }
    await actionHandlers(message)
    expect(message.respond.firstCall.args).deep.eql([{}])
  })
})
