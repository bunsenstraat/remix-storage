/* eslint-disable curly */
import {
  createClient
} from '@remixproject/plugin-webview'
import {
  PluginClient
} from '@remixproject/plugin'
import {
  default as Box
} from '3box'
import {
  getAddress
} from '@ethersproject/address'
import $ from 'jquery'
import git, {
  FsClient,
  PromiseFsClient
} from 'isomorphic-git'
import FS from '@isomorphic-git/lightning-fs'
import EventEmitter from 'events'
import IpfsHttpClient from 'ipfs-http-client'
import httpclient from 'isomorphic-git/http/web/index'
import path from 'path'
import CodeMirror from 'codemirror/lib/codemirror.js'
import {
  Diff,
  diffLines,
  diffChars,
  createPatch
} from 'diff'
import * as Diff2Html from 'diff2html'
import WalletConnectProvider from '@walletconnect/web3-provider'
import Web3Modal from 'web3modal'

const defaultHost = 'localhost' // ethdev berlin ipfs node
const defaultPort = 5001
const defaultProtocol = 'http'
const ipfsurl = 'https://ipfs.io/ipfs/'
export class WorkSpacePlugin extends PluginClient {
  constructor() {
    console.clear()
    super()

    this.fileeditor = CodeMirror.fromTextArea(document.getElementById('editor'), {
      lineNumbers: true
    })
    this.fileeditor.setValue('ready...')

    /*     this.newfileeditor = CodeMirror.fromTextArea(document.getElementById('newfileditor'), {
          lineNumbers: true
        });
        this.newfileeditor.setValue("add your content here") */

    this.filesToSend = []

    // This inits a IndexedDB database
    this.fs = new FS('remix-workspace')
    this.fsp = this.fs.promises

    console.log('app started')

    // REMIX CLIENT
    this.client = createClient(this)
    this.client.onload().then(async () => {
      console.log('workspace client loaded', this)
      // await this.getFilesFromIde()
      // await this.addToIpfs()

      this.client.on('fileManager', 'fileSaved', async (e) => {
        // Do something
        console.log(e)
        await this.addFileFromBrowser(e)
      })

      this.client.on('fileManager', 'currentFileChanged', async (e) => {
        // Do something
        console.log(e)
      })

      this.client.on('fileManager', 'fileRemoved', async (e) => {
        // Do something
        console.log(e)
      })

      this.client.on('fileManager', 'fileRenamed', async (e) => {
        // Do something
        console.log(e)
      })

      this.client.on('fileManager', 'fileAdded', async (e) => {
        // Do something
        console.log(e)
        await this.addFileFromBrowser(e)
      })

      await this.gitinit()
    })

    this.setClickHandlers()
    // IPFS HOST

    this.ipfs = IpfsHttpClient({
      host: defaultHost,
      port: defaultPort,
      protocol: defaultProtocol
    })

    this.showFiles()

    return undefined
  }

  // UI CLICK HANDLERS

  async setClickHandlers() {
    $('#files-btn').click(async () => {
      await this.showFiles()
    })
    $('#clear-btn').click(async () => {
      await this.clearDb()
    })
    $('#init-btn').click(async () => {
      await this.gitinit()
    })
    $('#commit-btn').click(async () => {
      await this.commit()
    })
    $('#main-btn').click(async () => {
      await this.addToIpfs()
    })
    $('#clone-btn').click(async () => {
      await this.clone()
    })
    $('#status-btn').click(async () => {
      await this.log()
    })
    $('#addfile-btn').click(async () => {
      await this.addFile()
    })
    $('#savefile-btn').click(async () => {
      await this.saveFile()
    })
    $('#wallet-btn').click(async () => {
      await this.openModal()
    })
    $('#3box-btn').click(async () => {
      await this.connect3Box()
    })
    $('#3boxExport-btn').click(async () => {
      await this.storeHashIn3Box()
    })
    $('#import3b-btn').click(async () => {
      await this.importFrom3Box()
    })

    $('.nav-link').click(async (...args) => {
      await this.navigateTo(args)
    })

    $(document).on('click', '.viewfile', async (...args) => {
      await this.viewFile(args)
    })
    $(document).on('click', '.checkout-btn', async (...args) => {
      await this.checkout(args)
    })
    $(document).on('click', '.diff', async (...args) => {
      await this.diffFile(args)
    })
    $(document).on('click', '.addgit', async (...args) => {
      await this.addToGit(args)
    })
  }

  // UI Elements

  async showtoast(str = '') {
    $('.toast-body').html(str)
    $('.toast').css('top', window.scrollY + window.innerHeight / 2)
    $('.toast').css('right', window.innerWidth / 2 - $('.toast').outerWidth() / 2)
    $('.toast').toast('show')
  }

  async addAlert(id, message) {
    $(`#${id}`).html(message).removeClass().addClass('alert').addClass('alert-danger').addClass('mt-2').show()
  }

  async addInfo(id, message) {
    $(`#${id}`).html(message).removeClass().addClass('alert').addClass('alert-info').addClass('mt-2').show()
  }

  async addSuccess(id, message) {
    $(`#${id}`).html(message).removeClass().addClass('alert').addClass('alert-success').addClass('mt-2').show()
  }

  // Git functions

  async gitinit() {
    const fs = this.fs
    try {
      await git.init({
        fs,
        dir: '/'
      })
      // alert("git init done")
      this.showtoast('GIT initialized')
      await this.showFiles()
    } catch (e) {
      this.showtoast('Could not init git!')
    }
  }

  async addToGit(args) {
    console.log('ADD TO GIT', $(args[0].currentTarget).data('file'))
    const filename = $(args[0].currentTarget).data('file')
    const basename = path.basename(filename)
    const directory = path.dirname(filename)
    console.log('will add', basename, directory)
    const fs = this.fs
    const added = await git.add({
      fs,
      dir: '/',
      filepath: this.removeSlash(filename)
    })
    await this.showFiles()
    this.showtoast('added ', added)
  }

  async checkout(args) {

    const oid = $(args[0].currentTarget).data('oid')
    console.log("checkout", oid)
    let fs = this.fs
    await git.checkout({
      fs,
      dir: '/',
      ref: oid
    })

    console.log('done')
    await this.showFiles();
  }

  // File functions

  async clearDb() {
    const req = indexedDB.deleteDatabase('remix-workspace')
    const me = this

    req.onsuccess = async function () {
      me.showtoast('Deleted database successfully')
      await me.log()
      await me.showFiles()
    }
  }

  async addFileFromBrowser(file) {
    const content = await this.client.call('fileManager', 'readFile', file)
    await this.addFile(file, content)
  }

  async addFile(file, content) {
    console.log('add file ', file)
    const directories = path.dirname(file)
    await this.createDirectoriesFromString(directories)
    await this.fsp.writeFile('/' + file, content)
    await this.showFiles()
  }

  async createDirectoriesFromString(directories) {
    const ignore = ['.', '/.', '']
    console.log('directory', directories, ignore.indexOf(directories))
    if (ignore.indexOf(directories) > -1) return false
    directories = directories.split('/')
    console.log('create directory', directories)
    for (let i = 0; i < directories.length; i++) {
      console.log(directories[i])
      let previouspath = ''
      if (i > 0)
        previouspath = '/' + directories.slice(0, i).join('/')
      const finalPath = previouspath + '/' + directories[i]
      console.log('creating ', finalPath)
      try {
        await this.fsp.mkdir(finalPath)
      } catch (e) {
        console.log(e)
      }
    }
  }

  async viewFile(args) {
    const filename = $(args[0].currentTarget).data('file')
    console.log($(args[0].currentTarget).data('file'))
    await this.client.call('fileManager', 'switchFile', `${this.removeSlash(filename)}`)
  }

  async saveFile() {
    const filename = $('#editorfile').html()
    const content = this.fileeditor.getValue()
    await this.fsp.writeFile(filename, content)
    await this.showFiles()
    $('#editor-container').hide()
  }

  async diffFile(args) {
    $('#files').hide()
    $('#diff-container').show()
    const fs = this.fs
    const fullfilename = $(args[0].currentTarget).data('file')
    const filename = path.basename($(args[0].currentTarget).data('file'))
    const commitOid = await git.resolveRef({
      fs,
      dir: '/',
      ref: 'master'
    })

    try {
      const {
        blob
      } = await git.readBlob({
        fs,
        dir: '/',
        oid: commitOid,
        filepath: this.removeSlash(fullfilename)
      })

      const original = await this.fsp.readFile(fullfilename, {
        encoding: 'utf8'
      })
      const newcontent = Buffer.from(blob).toString('utf8')
      const filediff = createPatch(filename, original, newcontent) // diffLines(original,newcontent)

      const diffview = Diff2Html.html(filediff)
      $('#diffviewer').html(diffview)
    } catch (e) {
      this.showtoast("Nothing to diff!")
      $('#files').show()
      $('#diff-container').hide()
    }
  }

  async getDirectory(dir) {
    console.log('get directory')
    let result = []
    const files = await this.fsp.readdir(`${dir}`)
    console.log('readdir', files)
    // await files.map(async (fi)=>{
    for (let i = 0; i < files.length; i++) {
      const fi = files[i]
      if (typeof fi !== 'undefined') {
        // console.log('looking into ', fi, dir)
        if (dir === '/') dir = ''
        const type = await this.fsp.stat(`${dir}/${fi}`)
        if (type.type === 'dir') {
          // console.log('is directory, so get ', `${dir}/${fi}`)
          result = [...result, ...await this.getDirectory(`${dir}/${fi}`)]
        } else {
          // console.log('is file ', `${dir}/${fi}`)
          result.push(`${dir}/${fi}`)
        }
      }
    }

    // })
    return result
  }

  async jsonObjectFromFileList(files) {
    const ob = []
    // reindex filelist
    files.map((f, i) => {
      const dirname = path.dirname(files[i])
      if (dirname.startsWith('/.'))
        return true
      const basename = path.basename(files[i])
      const directories = this.removeSlash(dirname).split('/')
      if (!ob.find((x) => {
          return x.fullname === dirname
        })) ob.push({
        type: 'dir',
        name: directories.pop(),
        fullname: dirname,
        parentDir: path.dirname(dirname)
      })

      let previouspath = ''
      for (let i = 0; i < directories.length; i++) {
        if (i > 0)
          previouspath = '/' + directories.slice(0, i).join('/')
        const finalPath = previouspath + '/' + directories[i]
        if (!ob.find((x) => {
            return x.fullname === finalPath
          })) ob.push({
          type: 'dir',
          name: directories[i],
          fullname: finalPath,
          parentDir: path.dirname(finalPath)
        })
      }
      if (!ob.find((x) => {
          return x.fullname === files[i]
        })) ob.push({
        type: 'file',
        name: basename,
        fullname: files[i],
        directory: dirname,
        status: []
      })
    })
    // asign ids
    ob.map((f, i) => {
      f.id = i
    })
    // find parents
    ob.map((f, i) => {
      if (f.type === 'file') {
        // f.parent
        const parent = ob.find((x) => {
          return (x.fullname === f.directory) && (x.type === 'dir')
        })
        f.parentId = parent ? parent.id : undefined
      } else {
        console.log(f)
        const parent = ob.find((x) => {
          return (x.fullname === f.parentDir) && (x.type === 'dir')
        })
        f.parentId = parent ? parent.id : undefined
      }
    })
    // build the tree
    const t = {}
    ob.forEach(o => {
      Object.assign(t[o.id] = t[o.id] || {}, o)
      t[o.id].children = null
      t[o.parentId] = t[o.parentId] || {}
      t[o.parentId].children = t[o.parentId].children || []
      t[o.parentId].children.push(t[o.id])
    })
    console.log(t[0])

    // console.log('OB', ob)
    return t[0]
  }

  removeSlash(s) {
    return s.replace(/^\/+/, '')
  }

  async clone() {
    await this.clearDb()
    const cid = $('#ipfs').val()
    console.log(cid)
    // return true;

    for await (const file of this.ipfs.get(cid)) {
      file.path = file.path.replace(cid, '')
      console.log(file.path)
      if (!file.content) {
        //
        await this.createDirectoriesFromString(file.path)
        continue
      }
      console.log(file.content)
      const content = []
      for await (const chunk of file.content) {
        content.push(chunk)
      }
      await this.fsp.writeFile(file.path, content[0] || new Uint8Array())
    }

    await this.showFiles()
  }

  async showFiles() {
    $('#files').show()
    $('#diff-container').hide()
    let files = await this.getDirectory('/')
    let jsonfiles = await this.jsonObjectFromFileList(files)
    console.log('files', jsonfiles)
    const tree = require('./tree.html')
    const partial = require('./partial.html')
    //var rendered = tree.render(jsonfiles)
    var rendered = tree.render(jsonfiles, {
      "recurse": partial
    });
    $('#files').html(rendered)
    const matrix = (await git.statusMatrix({
      fs: this.fs,
      dir: '/'
    })).map((x) => {
      return {
        filename: `/${x.shift()}`,
        status: x
      }
    })

    const statusmatrix = [
      ['new, untracked', 0, 2, 0], // new, untracked
      ['added, staged', 0, 2, 2], //
      ['added, staged, with unstaged changes', 0, 2, 3], // added, staged, with unstaged changes
      ['unmodified', 1, 1, 1], // unmodified
      ['modified, unstaged', 1, 2, 1], // modified, unstaged
      ['modified, staged', 1, 2, 2], // modified, staged
      ['modified, staged, with unstaged changes', 1, 2, 3], // modified, staged, with unstaged changes
      ['deleted, unstaged', 1, 0, 1], // deleted, unstaged
      ['deleted, staged', 1, 0, 0] // deleted, staged
    ].map((x) => {
      return {
        matrix: x.shift().split(','),
        status: x
      }
    })

    // console.log(statusmatrix);
    console.log('matrix', statusmatrix)
    const status = require('./status.html')
    const buttons = require('./buttons.html')
    matrix.map((m) => {
      //console.log(m)
      const el = $("#files").find(`[data-fullname='${m.filename}']`)
      statusmatrix.map((sm) => {
        if (JSON.stringify(sm.status) === JSON.stringify(m.status)) {
          $(el).find(".status").html(status.render({
            status: sm.matrix
          }))
          $(el).find(".buttons").html(buttons.render({
            name: m.filename
          }))
        }
      });
      //console.log(status.render({status:["deleted", " staged"]}))
      //console.log(m.matrix)

    })
    await this.log()
    return true
  }

  async getFilesFromIde() {
    const files = await this.client.call('fileManager', 'readdir', 'browser')
    console.log(files)
    const filelist = []
    Object.keys(files).map(function (key, index) {
      filelist.push(key)
      return true
    })
    const template = require('./files.html')
    const html = template({
      files: filelist
    })
    $('#fileList').html(html)
  }

  Decodeuint8arr(uint8array) {
    return new TextDecoder('utf-8').decode(uint8array)
  }

  async log() {
    const fs = this.fs
    $('#status').empty()
    // console.log(fs);

    try {
      const commits = await git.log({
        fs,
        dir: '/',
        depth: 5
      })

      commits.map((x) => {
        console.log(x)
        x.date = new Date(x.commit.committer.timestamp * 1000).toString()
        // x.date = x.commit.committer.timestamp
        return x
        // $("#status").append(x.commit.message).append(x.oid).append("<br>");
      })

      const template = require('./commits.html')
      const html = template.render({
        commits: commits
      })
      $('#status').html(html)
    } catch (e) {
      console.log(e)
      $('#status').html('Log is empty')
    }

    await this.currentBranch()
  }

  async currentBranch() {
    $('#branch').empty()
    const fs = this.fs
    try {
      const branch = await git.currentBranch({
        fs,
        dir: '/',
        fullname: false
      })
      $('#init-btn').hide()
      $('.gitIsReady').show()
      if (typeof branch === 'undefined') {
        this.addAlert('branch', `You are in a detached state`)
      } else {
        this.addInfo('branch', `Branch is: ${branch}`)
      }
      console.log('BRANCH', branch)
    } catch (e) {
      // this means git is not init
      $('#init-btn').show()
      $('.gitIsReady').hide()
      this.addAlert('branch', 'Git is not initialized.')
      this.showtoast('Git not initialized.')
    }
  }

  async commit() {
    const fs = this.fs
    const sha = await git.commit({
      fs,
      dir: '/',
      author: {
        name: 'Remix Workspace',
        email: 'mrtest@example.com'
      },
      message: $('#message').val()
    })
    this.showtoast(`commited ${sha}`)
    await this.showFiles()
  }

  async addToIpfs() {
    this.filesToSend = []
    const files = await this.getDirectory('/')
    console.log('files to send', files, files.length)
    for (let i = 0; i < files.length; i++) {
      const fi = files[i]
      console.log('fetching ', fi)
      const ob = {
        path: fi,
        content: await this.fsp.readFile(fi)
      }
      this.filesToSend.push(ob)
    }

    const addOptions = {
      wrapWithDirectory: true
    }
    try {
      await this.ipfs.add(this.filesToSend, addOptions).then((x) => {
        console.log(x.cid.string)
        $('#CID').attr('href', `${ipfsurl}${x.cid.string}`)
        $('#CID').html(`Your files are here: ${x.cid.string}`)
        this.cid = x.cid.string
      })
      this.addSuccess('ipfsAlert', `You files were uploaded to IPFS ${this.cid}`)
    } catch (e) {
      this.addAlert('ipfsAlert', 'There was an error uploading to IPFS, please check your IPFS settings if applicable.')
      this.showtoast('There was an error uploading to IPFS!')
      console.log(e)
    }

    return true
  }

  // 3BOX connection

  async connect3Box() {
    this.box = await Box.openBox(this.address, this.provider)
    this.space = await this.box.openSpace('remix-workspace')
    console.log(this.space)
  }

  async storeHashIn3Box() {
    console.log('export 3box', this.cid, this.space)
    await this.space.private.set('cid', this.cid)
    this.showtoast('stored in 3box')
  }

  async importFrom3Box() {
    const cid = await this.space.private.get('cid')
    console.log('cid', cid)
    this.cid = cid
    $('#ipfs').val(this.cid)
    await this.clone()
  }

  // WEB3 modal functions

  async initModal() {
    try {
      const currentTheme = await this.call('theme', 'currentTheme')
      console.log('theme', currentTheme)
      this.web3Modal.updateTheme(currentTheme.quality)

      this.on('theme', 'themeChanged', (theme) => {
        this.web3Modal.updateTheme(theme.quality)
        console.log('theme', theme)
      })

      this.web3Modal.on('connect', async (provider) => {
        this.provider = provider
        const [address] = await this.provider.enable()
        this.address = getAddress(address)
        console.log(this.address)
        /*         this.internalEvents.emit('accountsChanged', provider.accounts || [])
                this.internalEvents.emit('chainChanged', provider.chainId)
                this.provider.on("accountsChanged", (accounts) => {
                  this.internalEvents.emit('accountsChanged', accounts || [])
                });

                this.provider.on("chainChanged", (chain) => {
                  this.internalEvents.emit('chainChanged', chain)
                }); */
      })
    } catch (e) {
      console.log(e)
    }
  }

  async openModal() {
    if (!this.web3Modal) {
      this.web3Modal = new Web3Modal({
        providerOptions: this.getProviderOptions() // required
      })
      await this.initModal()
    }
    if (!this.web3Modal.show) {
      this.web3Modal.toggleModal()
    }
  }

  getProviderOptions() {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: '83d4d660ce3546299cbe048ed95b6fad'
        }
      }
    }
    return providerOptions
  };
}