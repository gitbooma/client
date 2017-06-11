var copyfiles	= require('copyfiles'),
	fs 			= require('fs-extra'),
	rimraf		= require('rimraf'),
	config		= require('./config/config.json')
	taxonomy	= require('./src/js/config/taxonomy.js'),
	CleanCSS	= require('clean-css')


function setup(){
	return 	Promise.all([
				fs.emptyDir('dev'),
				fs.emptyDir('tmp')
			])
}


function copyQRCodeScriptsSrc2Dev(){
	return 	fs.ensureDir('dev/js')
			.then( () => Promise.all([
				fs.copy('node_modules/qrcode-generator/js/qrcode_UTF8.js', 	'dev/js/qrcode_UTF8.js'),
				fs.copy('node_modules/qrcode-generator/js/qrcode.js', 		'dev/js/qrcode.js'),
				fs.copy('node_modules/angular-qrcode/angular-qrcode.js', 	'dev/js/angular-qrcode.js')
			]))
}

function compileTaxonomyTemplate(key, template){
	return 		fs.readFile(template, 'utf8')
				.then(function(template){
					return	taxonomy[key].map(function(item){
								if(!item.name) 					console.error('Taxonomy templates: Missing name:',key , item)
								if(item.name.match(/[^a-z_]/)) 	console.error('Taxonomy templates: Only lower case letters and "_" allowed in names:',key , item.name)
								return	template
										.replace(/{{name}}/g, 			item.name)
										.replace(/{{color\[([0-9]+)\]}}/g, 
											function(match, p1){
												var color = item.colors && item.colors[parseInt(p1)]
												if(!color) console.error('Taxonomy templates: missing color: {{color['+p1+']}}', item.name)

												return color
											}
										)
							})
							.join('\n\n')
				})
}


function compileTaxonomyTemplatesToTmp() {
	return	Promise.all([
				compileTaxonomyTemplate('categories', 	'src/styles/templates/ic-category.template'),
				compileTaxonomyTemplate('types', 		'src/styles/templates/ic-types.template')
			])
			.then(function(results){			 
				return 	fs.ensureDir('tmp/styles')
						.then(() => fs.writeFile('tmp/styles/taxonomy.css', results.join('\n\n'), 'utf8'))
			})
}

function svgColors(src_folder, dest_folder, config){
	return	fs.ensureDir(dest_folder)
			.then( () => fs.readdir(src_folder) )
			.then( result => result.filter( (filename) => filename.match(/\.svg$/) && fs.lstatSync(src_folder+'/'+filename).isFile()) )
			.then( (filenames) => Promise.all(
				filenames.map( (filename) => {
					return	fs.readFile(src_folder+'/'+filename, 'utf8')
							.then( (content) => Promise.all( config.colors.map( color => {
								var fn = 	color.name
											?	filename.replace(/\.svg$/,'-'+color.name+'.svg')
											:	filename

									return fs.writeFile(dest_folder+'/'+fn, content.replace(new RegExp(config.replace, "g"), color.value), 'utf8')
							})))
				})				
			))
}

function images2Css(src_folder, dst_folder, template_file, preload){

	return	Promise.all([
				fs.readFile(template_file, 'utf8'),
				fs.readdir(src_folder)
			])
			.then(result => {
				var template	= 	result[0], 
					filenames 	= 	result[1].filter( (filename) => fs.lstatSync(src_folder+'/'+filename).isFile())
					preload		= 	preload
									?	'\n\nbody:before{\n display:none;\n content:'
										+ filenames.map( (fn) => '\turl('+dst_folder+'/'+ fn + ')' ).join('')
										+ ';\n}\n\n'
									: ''

				return 	filenames.map(function(filename){

							var parts = filename.replace(/\..*/g, '').split('-')

							return 	template
									.replace(/{{([^{}[]]*)name\[([0-9]+)\]}}/g, function(match, p1, p2){
										var part = parts && parts[parseInt(p2)]

										return 	part
												?	p1+part
												:	''
									})
									.replace(/{{name}}/g, dst_folder+'/'+filename)
						})
						.join('\n\n')
						+ preload 
			})
}


///////////////////////


function compileIconsSrc2Tmp(){
	return 	svgColors('src/images/raw_icons', 'tmp/images/icons', {
				replace: '#000000',
				colors: [
					{name: null,		value: '#000000'},
					{name: 'active',	value: config.activeIconColor || '#802651'},
					{name: 'white',		value: '#ffffff'}
				]
			})
}

function compileMarkersSrc2Tmp(){
	return 	svgColors('src/images/raw_markers', 'tmp/images/icons', {
				replace: '#7F7F7F',
				colors: taxonomy.categories.map( category => { return {name: category.name, value: category.colors[0] } })
						.concat([
							{name: 'unknown', value: '#7F7F7F'}
						])
			})
}


function compileIconTemplatesTmp2Tmp(){
	return	images2Css('tmp/images/icons', '/images/icons', 'src/styles/templates/ic-icon.template', true)
			.then( css => fs.ensureDir('tmp/styles').then( () => fs.writeFile('tmp/styles/icons.css', css , 'utf8')) )
}

function compileImageTemplatesSrc2Tmp(){
	return	images2Css('src/images/large', '/images/large', 'src/styles/templates/ic-image.template')
			.then( css => fs.ensureDir('tmp/styles').then( () => fs.writeFile('tmp/styles/images.css', css , 'utf8')) )
}


function prepareBiyarni(){

	return 	Promise.all([
				fs.readFile("node_modules/typeface-biryani/index.css",	"utf8"),
				fs.copy("node_modules/typeface-biryani/files",			"dev/fonts/Biyarni"),
				fs.ensureDir("dev/styles")
			])
			.then( result	=> result[0].replace(/\.\/files/g, '/fonts/Biyarni'))
			.then( css 		=> fs.writeFile('tmp/styles/biryani.css', css, 'utf8'))
}


function prepareRoboto(){

	return 	Promise.all([
				fs.readFile("node_modules/roboto-fontface/css/roboto/roboto-fontface.css",	"utf8"),
				fs.copy("node_modules/roboto-fontface/fonts/Roboto",		"dev/fonts/Roboto"),
				fs.ensureDir("dev/styles")
			])
			.then( result	=> result[0].replace(/\.\.\/\.\.\/fonts\/Roboto/g, '/fonts/Roboto'))
			.then( css 		=> fs.writeFile('tmp/styles/roboto.css', css, 'utf8'))
}

function copyFilesToTmp(){
	return 	Promise.all([
				fs.copy("src/images/icons", 	"tmp/images/icons"),
			])
}



function copyFilesToDev(){
	return 	Promise.all([

				fs.copy("src/js", 				"dev/js"),
				fs.copy("src/pages",			"dev/pages"),
				fs.copy("src/partials",			"dev/partials"),
				fs.copy("src/images/large", 	"dev/images/large"),
				fs.copy("vendor.js", 			"dev/js/vendor.js"),
				
				//tmp
				fs.copy("tmp/images", 		"dev/images"),
				

				//todo?
				fs.copy("config", 			"dev/config", {dereference: true}),
			])
}



function bundleStyles(src_dir, target_dir, filename){

	var	cleanCSS = new CleanCSS()

	return	fs.readdir(src_dir)
			.then(function(filenames){

				var filenames	=	filenames
									.map(function(fn){ 
										return 	fn.match(/\.css$/) 
												?	src_dir+'/'+fn
												:	undefined
									})
									.filter(function(x){ return !!x }),

					minify_result =	cleanCSS.minify(filenames)

				if(filenames.length == 0) return Promise.reject('bundleStyles: files missing.')


				return 	minify_result.errors.length
						?	Promise.reject(minify_result.errors)
						:	minify_result.styles
			})
			.then(function(css){
				return	fs.ensureDir(target_dir)
						.then(() => fs.writeFile(target_dir+'/'+filename, css, 'utf8'))
			})
}


function bundleStylesToDev(){

	return 	Promise.all([
				fs.copy("src/styles", 									"tmp/styles"),	
				fs.copy("node_modules/leaflet/dist/leaflet.css", 		"tmp/styles/leaflet.css"),
				fs.copy("src/styles/initial", 							"tmp/styles/initial")
			])
			.then(() => Promise.all([
				bundleStyles('tmp/styles', 			'dev/styles', 'styles.css'),
				bundleStyles('tmp/styles/initial', 	'dev/styles', 'initial.css')
			]))
}



function compileIndex(){

	return 	Promise.all([
				fs.readFile('src/index.html', 		'utf8'),
				fs.readFile('src/dev_head.html', 	'utf8')
			])
			.then(function(result){
				var index	= result[0],
					head 	= result[1]

				head = head.replace(/CONFIG/g, JSON.stringify(config))	

				return	index
						.replace(/CONFIG\.BACKEND\_LOCATION/g, 		config.backendLocation)
						.replace(/\s*<\!--\s*BUILD HEAD\s*-->/g, 	'\n'+head)
			})
			.then(function(content){
				return fs.writeFile('dev/index.html', content, 'utf8')				
			})
}




function cleanUp(){
	return fs.remove('tmp')
}

setup()


.then( () => process.stdout.write('\nCopying qr code scripts from /src to /dev ...'))
.then(copyQRCodeScriptsSrc2Dev)
.then( () =>  process.stdout.write('Done.\n'))



.then( () => process.stdout.write('\nCopying files from /src to /tmp for further processing ...'))
.then(copyFilesToTmp)
.then( () =>  process.stdout.write('Done.\n'))



.then( () => process.stdout.write('\nCompiling raw icons from /src to /tmp for further processing ...'))
.then(compileIconsSrc2Tmp)
.then( () =>  process.stdout.write('Done.\n'))


.then( () => process.stdout.write('\nCompiling raw markers from /src to /tmp for further processing ...'))
.then(compileMarkersSrc2Tmp)
.then( () =>  process.stdout.write('Done.\n'))



.then( () => process.stdout.write('\nCompiling icon templates for icons in /tmp into /tmp for further processing ...'))
.then(compileIconTemplatesTmp2Tmp)
.then( () =>  process.stdout.write('Done.\n'))


.then( () => process.stdout.write('\nCompiling taxonomy templates into /tmp for further processing ...'))
.then(compileTaxonomyTemplatesToTmp)
.then( () =>  process.stdout.write('Done.\n'))



.then( () => process.stdout.write('\nCompiling image templates for images in /src into /tmp for further processing ...'))
.then(compileImageTemplatesSrc2Tmp)
.then( () =>  process.stdout.write('Done.\n'))


.then( () => process.stdout.write('\nPreparing Biyarni...'))
.then(prepareBiyarni)
.then( () =>  process.stdout.write('Done.\n'))


.then( () => process.stdout.write('\nPreparing Roboto...'))
.then(prepareRoboto)
.then( () =>  process.stdout.write('Done.\n'))


.then( () => process.stdout.write('\nCopying ready files to /dev...'))
.then(copyFilesToDev)
.then( () => process.stdout.write('Done.\n'))

.then( () => process.stdout.write('\nBuidling styles into /dev...'))
.then(bundleStylesToDev)
.then( () => process.stdout.write('Done.\n'))


.then( () => process.stdout.write('\nCompiling Index into /dev...'))
.then(compileIndex)
.then( () =>  process.stdout.write('Done.\n'))



// .then( () => process.stdout.write('\nCleaninng up...'))
// .then(cleanUp)
// .then( () => process.stdout.write('Done.'))


.then(
	()	=> process.stdout.write('\nAll done. \n'),
	e	=> console.trace(e)
)







