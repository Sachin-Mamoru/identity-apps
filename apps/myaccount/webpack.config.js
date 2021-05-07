/**
 * Copyright (c) 2019, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const path = require("path");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const BrotliPlugin = require("brotli-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const deploymentConfig = require("./src/public/deployment.config.json");

// Flag to enable source maps in production.
const isSourceMapsEnabledInProduction = false;

// Enable/Disable profiling in Production.
const isProfilingEnabledInProduction = false;

// ESLint Config File Names
const DEVELOPMENT_ESLINT_CONFIG = ".eslintrc.js";
const PRODUCTION_ESLINT_CONFIG = ".prod.eslintrc.js";

// Paths
const APP_SOURCE_DIRECTORY = "src";                // App source code directory.
const APP_NODE_MODULES_DIRECTORY = "node_modules"; // Node modules.
const OUTPUT_PATH = "build/myaccount";             // Build artifacts output path.
const CACHE_DIRECTORY = "cache";                   // Output directory for the cache files. Only applicable in dev mode.
const STATIC_ASSETS_DIRECTORY = "static/media";    // Output directory for static assets i.e .png, .jpg etc.

// Dev Server Default Configs.
const DEV_SERVER_PORT = 9000;
const ROOT_CONTEXT_DEV_SERVER_INITIAL_REDIRECT = "/login";

module.exports = (env) => {

    // Build Environments.
    const isProduction = env.NODE_ENV === "production";
    const isDevelopment = env.NODE_ENV === "development";

    // Flag to determine if the app is intended to be deployed on an external server.
    // If true, references & usage of internal JAVA classes and resources inside the index.jsp
    // will be removed. Since these resources are only available inside IS runtime, when hosted
    // externally, the server (tomcat etc.) will throw errors when trying to resolve them.
    const isDeployedOnExternalServer = env.IS_DEPLOYED_ON_EXTERNAL_SERVER;

    // Analyzing mode options.
    const isAnalyzeMode = env.ENABLE_ANALYZER === "true";
    const analyzerPort = env.ANALYZER_PORT;

    // Profiling mode options.
    const isProfilingMode = env.ENABLE_BUILD_PROFILER === "true";

    // Dev Server Options.
    const isDevServerHostCheckDisabled = env.DISABLE_DEV_SERVER_HOST_CHECK === "true";

    // Log level.
    const logLevel = env.LOG_LEVEL
        ? env.LOG_LEVEL
        : isProfilingMode
            ? "info"
            : "none";

    const basename = deploymentConfig.appBaseName;
    const devServerPort = env.DEV_SERVER_PORT || DEV_SERVER_PORT;
    const publicPath = `/${ basename }`;
    const isRootContext = publicPath === "/";

    // Build configurations.
    const distFolder = path.resolve(__dirname, OUTPUT_PATH);
    const titleText = deploymentConfig.ui.appTitle;

    // Paths to configs & other required files.
    const PATHS = {
        appNodeModules: APP_NODE_MODULES_DIRECTORY,
        appSrc: APP_SOURCE_DIRECTORY,
        assets: STATIC_ASSETS_DIRECTORY,
        cache: path.resolve(__dirname, CACHE_DIRECTORY),
        eslintrc: isProduction
            ? path.resolve(__dirname, PRODUCTION_ESLINT_CONFIG)
            : path.resolve(__dirname, DEVELOPMENT_ESLINT_CONFIG)
    };

    return {
        cache: {
            cacheDirectory: PATHS.cache,
            // Possible strategies are 'memory' | 'filesystem'.
            type: "filesystem"
        },
        context: path.resolve(__dirname),
        devServer: {
            before: function (app) {
                app.get("/", function (req, res) {
                    // In root context, `publicPath` is `/`. This causes a redirection loop.
                    // TO overcome this, redirect to `/login` in root context.
                    res.redirect(
                        !isRootContext
                            ? publicPath
                            : ROOT_CONTEXT_DEV_SERVER_INITIAL_REDIRECT
                    );
                });
            },
            // WebpackDevServer 2.4.3 introduced a security fix that prevents remote
            // websites from potentially accessing local content through DNS rebinding:
            // https://github.com/webpack/webpack-dev-server/issues/887
            // This has resulted in issues such as development in cloud environment or subdomains impossible.
            disableHostCheck: isDevServerHostCheckDisabled,
            contentBase: distFolder,
            historyApiFallback: true,
            host: "localhost",
            hot: true,
            https: true,
            inline: true,
            openPage: basename,
            port: devServerPort,
            writeToDisk: true
        },
        devtool: isProduction
            ? isSourceMapsEnabledInProduction
                ? "source-map"
                : false
            : isDevelopment && "eval-cheap-module-source-map",
        entry: {
            init: [ "@babel/polyfill", "./src/init/init.ts" ],
            main: "./src/index.tsx",
            rpIFrame: "./src/init/rpIFrame-script.ts"
        },
        infrastructureLogging: {
            // Log level is set to `none` by default to get rid of un-necessary logs from persistent cache etc.
            // This is set to `info` in profiling mode to get the desired result.
            level: logLevel
        },
        mode: isProduction ? "production" : "development",
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: ["style-loader", "css-loader"]
                },
                {
                    exclude: /node_modules/,
                    test: /\.css$/,
                    use: [ "postcss-loader" ]
                },
                {
                    generator: {
                        filename: isProduction
                            ? `${ PATHS.assets }/[hash][ext][query]`
                            : `${ PATHS.assets }/[path][name][ext]`
                    },
                    test: /\.(png|jpg|cur|gif|eot|ttf|woff|woff2)$/,
                    type: "asset/resource"
                },
                {
                    test: /\.svg$/,
                    use: [
                        {
                            loader: "@svgr/webpack",
                            options: {
                                svgoConfig: {
                                    plugins: [{ prefixIds: false }]
                                }
                            }
                        },
                        {
                            loader: "file-loader",
                            options: {
                                name: isProduction
                                    ? `${ PATHS.assets }/[contenthash].[ext]`
                                    : `${ PATHS.assets }/[path][name].[ext]`
                            }
                        }
                    ]
                },
                {
                    test: /\.worker\.(ts|js)$/,
                    use: {
                        loader: 'worker-loader',
                        options: {
                            inline: true
                        }
                    },
                },
                {
                    exclude: {
                        and: [
                            /\.(spec|test).(ts|js)x?$/,
                            /node_modules(\\|\/)(core-js)/
                        ],
                        not: [
                            /joi/,
                            /react-notification-system/,
                            /less-plugin-rewrite-variable/,
                            /@wso2is(\\|\/)forms/,
                            /@wso2is(\\|\/)react-components/,
                            /@wso2is(\\|\/)theme/,
                            /@wso2is(\\|\/)validation/
                        ]
                    },
                    test: /\.(ts|js)x?$/,
                    use: [
                        {
                            loader: "thread-loader",
                            options: {
                                // there should be 1 cpu for the fork-ts-checker-webpack-plugin
                                workers: 1
                            }
                        },
                        {
                            loader: "babel-loader",
                            options: {
                                // When set, each Babel transform output will be compressed with Gzip.
                                // Project may benefit from this if it transpiles thousands of files.
                                // https://github.com/facebook/create-react-app/issues/6846
                                cacheCompression: false,
                                // This is a feature of `babel-loader` for webpack (not Babel itself).
                                // It enables caching results in ./node_modules/.cache/babel-loader/
                                // directory for faster rebuilds.
                                cacheDirectory: true,
                                // Babel will not include superfluous whitespace characters and line terminators.
                                // This produces warnings and slowness in dev server.
                                compact: isProduction,
                                plugins: [
                                    isDevelopment && require.resolve("react-refresh/babel")
                                ].filter(Boolean)
                            }
                        }
                    ]
                },
                {
                    enforce: "pre",
                    test: /\.js$/,
                    use: ["source-map-loader"]
                }
            ],
            // Makes missing exports an error instead of warning.
            strictExportPresence: true,
            // Speeds up the dev-ser by ~800ms. https://github.com/webpack/webpack/issues/12102#issuecomment-762963181
            unsafeCache: true
        },
        optimization: {
            concatenateModules: isProduction,
            minimize: isProduction,
            minimizer: [
                 new TerserPlugin({
                    extractComments: true,
                    terserOptions: {
                        compress: {
                            // Disabled because of an issue with Uglify breaking seemingly valid code:
                            // https://github.com/mishoo/UglifyJS2/issues/2011
                            comparisons: false,
                            ecma: 5,
                            // Disabled because of an issue with Terser breaking valid code:
                            // https://github.com/terser-js/terser/issues/120
                            inline: 2,
                            warnings: false
                        },
                        // prevent the compressor from discarding class names.
                        keep_classnames: isProfilingEnabledInProduction,
                        // Prevent discarding or mangling of function names.
                        keep_fnames: isProfilingEnabledInProduction,
                        output: {
                            // Regex is not minified properly using default.
                            // https://github.com/mishoo/UglifyJS/issues/171
                            ascii_only: true,
                            comments: false,
                            ecma: 5
                        },
                        parse: {
                            ecma: 8
                        }
                    }
                })
            ].filter(Boolean),
            // Keep the runtime chunk separated to enable long term caching
            // https://twitter.com/wSokra/status/969679223278505985
            runtimeChunk: {
                name: "single"
            },
            splitChunks: {
                chunks: "all"
            },
            // Tells webpack to determine used exports for each module.
            usedExports: true
        },
        output: {
            chunkFilename: isProduction
                ? "static/js/[name].[contenthash:8].chunk.js"
                : "static/js/[name].chunk.js",
            filename: isProduction
                ? "static/js/[name].[contenthash:8].js"
                : "static/js/[name].js",
            hotUpdateChunkFilename: "hot/[id].[fullhash].hot-update.js",
            hotUpdateMainFilename: "hot/[runtime].[fullhash].hot-update.json",
            path: distFolder,
            publicPath: isRootContext
                ? publicPath
                : `${ publicPath }/`
        },
        plugins: [
            isProfilingMode && new webpack.ProgressPlugin({
                profile: true
            }),
            isAnalyzeMode && new BundleAnalyzerPlugin({
                analyzerHost: "localhost",
                analyzerPort: analyzerPort
            }),
            isDevelopment && new webpack.HotModuleReplacementPlugin(),
            isDevelopment && new ReactRefreshWebpackPlugin({
                // React Refresh overlay shows errors for rejected promises and other errors
                // that shouldn't block the development. Hence, switching off for now.
                overlay: false
            }),
            // In webpack 5 automatic node.js polyfills are removed.
            // https://github.com/vfile/vfile/issues/38#issuecomment-640479137
            new webpack.ProvidePlugin({
                process: "process/browser"
            }),
            new ForkTsCheckerWebpackPlugin({
                async: isDevelopment,
                issue: {
                    exclude: [
                        {
                            file: "**/?(*.)(spec|test).*",
                            origin: "eslint"
                        },
                        {
                            file: "**/__tests__/**",
                            origin: "eslint"
                        },
                        {
                            file: "**/src/setupTests.*",
                            origin: "eslint"
                        }
                    ],
                    include: [
                        {
                            file: "**"
                        }
                    ]
                },
                typescript: {
                    diagnosticOptions: {
                        semantic: true,
                        syntactic: true
                    }
                }
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        context: path.join(__dirname, "node_modules", "@wso2is", "theme", "dist"),
                        from: "lib",
                        // Only Copy the required resources to distribution.
                        // ATM, only the theme CSS files, fonts and branding images are required.
                        globOptions: {
                            dot: true,
                            ignore: [ "**/**.js", "**/**.json", "**/assets/images/!(branding|flags.png)/**" ],
                        },
                        to: "libs"
                    },
                    {
                        context: path.join(__dirname, "node_modules", "@wso2is", "i18n"),
                        from: path.join("dist", "bundle"),
                        to: path.join("resources", "i18n")
                    },
                    {
                        context: path.join(__dirname, "src"),
                        force: true,
                        from: "public",
                        to: "."
                    },
                    {
                        context: path.join(__dirname, "src"),
                        force: true,
                        from: "auth.jsp",
                        to: "."
                    }
                ]
            }),
            isProduction
                ? new HtmlWebpackPlugin({
                    authorizationCode: "<%=request.getParameter(\"code\")%>",
                    contentType: "<%@ page language=\"java\" contentType=\"text/html; charset=UTF-8\" " +
                        "pageEncoding=\"UTF-8\" %>",
                    excludeChunks: [ "rpIFrame" ],
                    filename: path.join(distFolder, "index.jsp"),
                    hash: true,
                    importSuperTenantConstant: !isDeployedOnExternalServer
                        ? "<%@ page import=\"static org.wso2.carbon.utils.multitenancy." +
                        "MultitenantConstants.SUPER_TENANT_DOMAIN_NAME\"%>"
                        : "",
                    importTenantPrefix: !isDeployedOnExternalServer
                        ? "<%@ page import=\"static org.wso2.carbon.utils.multitenancy." +
                        "MultitenantConstants.TENANT_AWARE_URL_PREFIX\"%>"
                        : "",
                    importUtil: !isDeployedOnExternalServer
                        ? "<%@ page import=\"" +
                        "static org.wso2.carbon.identity.core.util.IdentityUtil.getServerURL\" %>"
                        : "",
                    publicPath: !isRootContext
                        ? publicPath
                        : "/",
                    serverUrl: !isDeployedOnExternalServer
                        ? "<%=getServerURL(\"\", true, true)%>"
                        : "",
                    sessionState: "<%=request.getParameter(\"session_state\")%>",
                    superTenantConstant: !isDeployedOnExternalServer
                        ? "<%=SUPER_TENANT_DOMAIN_NAME%>"
                        : "",
                    template: path.join(__dirname, "src", "index.jsp"),
                    tenantDelimiter: !isDeployedOnExternalServer
                        ? "\"/\"+'<%=TENANT_AWARE_URL_PREFIX%>'+\"/\""
                        : "",
                    tenantPrefix: !isDeployedOnExternalServer
                        ? "<%=TENANT_AWARE_URL_PREFIX%>"
                        : "",
                    title: titleText,
                    vwoScriptVariable: "<%= vwo_ac_id %>",
                    vwoSystemVariable: "<% String vwo_ac_id = System.getenv(\"vwo_account_id\"); %>"
                })
                : new HtmlWebpackPlugin({
                    excludeChunks: [ "rpIFrame" ],
                    filename: path.join(distFolder, "index.html"),
                    hash: true,
                    publicPath: !isRootContext
                        ? publicPath
                        : "/",
                    template: path.join(__dirname, "src", "index.html"),
                    title: titleText
                }),
            new HtmlWebpackPlugin({
                excludeChunks: [ "main", "init" ],
                filename: path.join(distFolder, "rpIFrame.html"),
                hash: true,
                publicPath: !isRootContext
                    ? publicPath
                    : "/",
                template: path.join(__dirname, "src", "rpIFrame.html")
            }),
            new webpack.DefinePlugin({
                "process.env": {
                    NODE_ENV: JSON.stringify(env.NODE_ENV)
                },
                "typeof window": JSON.stringify("object")
            }),
            // Moment locales take up ~160KB. Since this portal currently doesn't require all the moment locales,
            // temporarily require only the ones for the languages supported by default.
            // TODO: Remove this when dynamic runtime localization support is announced.
            new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /pt|si|ta/),
            isProduction && new CompressionPlugin({
                algorithm: "gzip",
                filename: "[path][base].gz",
                minRatio: 0.8,
                test: /\.(js|css|html|svg)$/,
                threshold: 10240
            }),
            isProduction && new BrotliPlugin({
                asset: "[path].br[query]",
                minRatio: 0.8,
                test: /\.(js|css|html|svg)$/,
                threshold: 10240
            }),
            new ESLintPlugin({
                cache: true,
                cacheLocation: path.resolve(
                    PATHS.appNodeModules,
                    ".cache/.eslintcache"
                ),
                context: PATHS.appSrc,
                eslintPath: require.resolve("eslint"),
                extensions: [ "js", "jsx", "ts", "tsx" ],
                overrideConfigFile: PATHS.eslintrc
            })
        ].filter(Boolean),
        resolve: {
            alias: {
                // Workaround to fix the invariant hook call exception, due to a
                // 3rd library lib using `react` as a dependency.
                // https://github.com/facebook/react/issues/13991#issuecomment-435587809
                react: path.resolve("../../node_modules/react")
            },
            extensions: [".tsx", ".ts", ".js", ".json"],
            // In webpack 5 automatic node.js polyfills are removed.
            // Node.js Polyfills should not be used in front end code.
            // https://github.com/webpack/webpack/issues/11282
            fallback: {
                buffer: false,
                fs: false
            }
        },
        // HMR is breaking in Webpack 5 when there is a `browserlist` present in package.json.
        // See https://github.com/webpack/webpack-dev-server/issues/2758#issuecomment-710086019
        target: isDevelopment
            ? "web"
            : "browserslist",
        watchOptions: {
            // eslint-disable-next-line no-useless-escape
            ignored: [ "/node_modules([\\]+|\/)+(?!@wso2is)/", "/build/" ]
        }
    };
};
