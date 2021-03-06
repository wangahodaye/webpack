/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Joel Denning @joeldenning
*/

"use strict";

const { ConcatSource } = require("webpack-sources");
const ExternalModule = require("../ExternalModule");
const Template = require("../Template");
const AbstractLibraryPlugin = require("./AbstractLibraryPlugin");

/** @typedef {import("webpack-sources").Source} Source */
/** @typedef {import("../../declarations/WebpackOptions").LibraryOptions} LibraryOptions */
/** @typedef {import("../../declarations/WebpackOptions").LibraryType} LibraryType */
/** @typedef {import("../Chunk")} Chunk */
/** @typedef {import("../Compilation").ChunkHashContext} ChunkHashContext */
/** @typedef {import("../Compiler")} Compiler */
/** @typedef {import("../javascript/JavascriptModulesPlugin").RenderContext} RenderContext */
/** @typedef {import("../util/Hash")} Hash */
/** @template T @typedef {import("./AbstractLibraryPlugin").LibraryContext<T>} LibraryContext<T> */

/**
 * @typedef {Object} SystemLibraryPluginOptions
 * @property {LibraryType} type
 */

/**
 * @typedef {Object} SystemLibraryPluginParsed
 * @property {string} name
 */

/**
 * @typedef {SystemLibraryPluginParsed} T
 * @extends {AbstractLibraryPlugin<SystemLibraryPluginParsed>}
 */
class SystemLibraryPlugin extends AbstractLibraryPlugin {
	/**
	 * @param {SystemLibraryPluginOptions} options the plugin options
	 */
	constructor(options) {
		super({
			pluginName: "SystemLibraryPlugin",
			type: options.type
		});
	}

	/**
	 * @param {LibraryOptions} library normalized library option
	 * @returns {T | false} preprocess as needed by overriding
	 */
	parseOptions(library) {
		const { name } = library;
		if (name && typeof name !== "string") {
			throw new Error(
				"System.js library name must be a simple string or unset"
			);
		}
		return {
			name: /** @type {string=} */ (name)
		};
	}

	/**
	 * @param {Source} source source
	 * @param {RenderContext} renderContext render context
	 * @param {LibraryContext<T>} libraryContext context
	 * @returns {Source} source with library export
	 */
	render(source, { chunkGraph, chunk }, { options, compilation }) {
		const modules = chunkGraph
			.getChunkModules(chunk)
			.filter(m => m instanceof ExternalModule);
		const externals = /** @type {ExternalModule[]} */ (modules);

		// The name this bundle should be registered as with System
		const name = options.name
			? `${JSON.stringify(compilation.getPath(options.name, { chunk }))}, `
			: "";

		// The array of dependencies that are external to webpack and will be provided by System
		const systemDependencies = JSON.stringify(
			externals.map(m =>
				typeof m.request === "object" && !Array.isArray(m.request)
					? m.request.amd
					: m.request
			)
		);

		// The name of the variable provided by System for exporting
		const dynamicExport = "__WEBPACK_DYNAMIC_EXPORT__";

		// An array of the internal variable names for the webpack externals
		const externalWebpackNames = externals.map(
			m =>
				`__WEBPACK_EXTERNAL_MODULE_${Template.toIdentifier(
					`${chunkGraph.getModuleId(m)}`
				)}__`
		);

		// Declaring variables for the internal variable names for the webpack externals
		const externalVarDeclarations =
			externalWebpackNames.length > 0
				? `var ${externalWebpackNames.join(", ")};`
				: "";

		// The system.register format requires an array of setter functions for externals.
		const setters =
			externalWebpackNames.length === 0
				? ""
				: Template.asString([
						"setters: [",
						Template.indent(
							externalWebpackNames
								.map(external =>
									Template.asString([
										"function(module) {",
										Template.indent(`${external} = module;`),
										"}"
									])
								)
								.join(",\n")
						),
						"],"
				  ]);

		return new ConcatSource(
			Template.asString([
				`System.register(${name}${systemDependencies}, function(${dynamicExport}) {`,
				Template.indent([
					externalVarDeclarations,
					"return {",
					Template.indent([
						setters,
						"execute: function() {",
						Template.indent(`${dynamicExport}(`)
					])
				])
			]) + "\n",
			source,
			"\n" +
				Template.asString([
					Template.indent([
						Template.indent([Template.indent([");"]), "}"]),
						"};"
					]),
					"})"
				])
		);
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {Hash} hash hash
	 * @param {ChunkHashContext} chunkHashContext chunk hash context
	 * @param {LibraryContext<T>} libraryContext context
	 * @returns {void}
	 */
	chunkHash(chunk, hash, chunkHashContext, { options, compilation }) {
		hash.update("SystemLibraryPlugin");
		if (options.name) {
			hash.update(compilation.getPath(options.name, { chunk }));
		}
	}
}

module.exports = SystemLibraryPlugin;
