import { get } from 'lodash'

export const BLOCK_REQUEST_TYPE_ACTION = 'block_actions'
export const BLOCK_REQUEST_TYPE_SUGGESTION = 'block_suggestion'
export const validBlockRequestTypes = [
  BLOCK_REQUEST_TYPE_ACTION,
  BLOCK_REQUEST_TYPE_SUGGESTION,
]

export const applyActionPlugins = async (actionPlugins, message, blockContext = {}) =>
  actionPlugins.reduce(async (previousPromise, plugin) => {
    const result = await previousPromise
    const nextResult = {
      ...result,
      ...(await plugin(message, blockContext)),
    }
    return Promise.resolve(nextResult)
  }, Promise.resolve({}))

const actionAndBlockIdParser = (message) => {
  let actionId
  let blockId

  if (message.body) {
    const isActionInteraction = get(message, 'body.actions.0')
    if (isActionInteraction) {
      // eslint-disable-next-line camelcase
      const { action_id, block_id } = isActionInteraction
      // eslint-disable-next-line camelcase
      actionId = action_id
      // eslint-disable-next-line camelcase
      blockId = block_id
    } else {
      // eslint-disable-next-line camelcase
      const { action_id, block_id } = message.body
      // eslint-disable-next-line camelcase
      actionId = action_id
      // eslint-disable-next-line camelcase
      blockId = block_id
    }
  }

  return {
    actionId,
    blockId,
  }
}

export const registeredActionsHandler = (
  actionsHandlerMap = {},
  actionPlugins = [],
  idsParser = actionAndBlockIdParser,
) => {
  const handleActionableRequest = async (message) => {
    const { actionId, blockId } = idsParser(message)
    const actionHandler = get(actionsHandlerMap, actionId)
    let response = {}

    if (actionHandler) {
      const extendedContext = {
        actionId,
        blockId,
        ...(await applyActionPlugins(actionPlugins, message, { actionId, blockId })),
      }
      response = await actionHandler(message, extendedContext)
    }

    message.respond(response)
  }

  return handleActionableRequest
}

export default (blockRequestHandlers) => {
  const getRequestHandler = requestType =>
    get(blockRequestHandlers, requestType)

  const middleware = async (message, next) => {
    const { type } = get(message, 'body', {})

    if (!validBlockRequestTypes.includes(type)) {
      return next()
    }
    const requestHandler = getRequestHandler(type)

    if (!requestHandler) {
      return next()
    }
    return requestHandler(message)
  }

  return middleware
}
