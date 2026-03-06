const requireAuth = (req, res, next) => {
  return req.app.get('auth').useRequireAuth()(req, res, next);
};

export const middleware = [requireAuth];
