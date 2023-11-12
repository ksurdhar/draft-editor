async function mockDynamic<T>(importFunction: () => Promise<{ default: T }>): Promise<T> {
  // eslint-disable-next-line @next/next/no-assign-module-variable
  const module = await importFunction()
  return module.default
}

export default mockDynamic
