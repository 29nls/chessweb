const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

/**
 * Webpack config overrides for react-app-rewired.
 * When ANALYZE=true, injects webpack-bundle-analyzer to generate
 * a static HTML report of the production bundle.
 */
module.exports = function override(config, env) {
  if (process.env.ANALYZE === 'true') {
    config.plugins.push(        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: 'bundle-report.html',
          openAnalyzer: false,
        })
    );
  }
  return config;
};
