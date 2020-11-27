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
    this.callBackEnabled = false


    // This inits a IndexedDB database
    this.fs = new FS('remix-workspace')
    this.fsp = this.fs.promises

    console.log('app started')
    this.showspinner();
    // REMIX CLIENT
    this.client = createClient(this)
    this.client.onload().then(async () => {
      console.log('workspace client loaded', this)
      // await this.getFilesFromIde()
      // await this.addToIpfs()
      this.hidespinner();
      $("#main").show();
      await this.enableCallBacks()


      await this.gitinit()
    })

    this.setClickHandlers()


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
      await this.gitlog()
    })
    $('#addfile-btn').click(async () => {
      await this.addFile()
    })
    $('#wallet-btn').click(async () => {
      await this.openModal()
    })
    $(document).on('click', '#boxconnect', async () => {
      await this.connect3Box()
    })
    $(document).on('click', '#boxexport', async () => {
      await this.storeHashIn3Box()
    })

    $(document).on('click', '#createbranch-btn', async () => {
      await this.createBranch()
    })


    $(document).on('click', '.viewfile', async (...args) => {
      await this.viewFile(args)
    })
    $(document).on('click', '.import3b-btn', async (...args) => {
      await this.importFrom3Box(args)
    })
    $(document).on('click', '.delete3b-btn', async (...args) => {
      await this.deleteFrom3Box(args)
    })

    $(document).on('click', '.checkout-btn', async (...args) => {
      await this.checkout(args)
    })
    $(document).on('click', '.gitrm', async (...args) => {
      await this.gitrm(args)
    })
    $(document).on('click', '.checkoutfile', async (...args) => {
      await this.checkoutfile(args)
    })
    $(document).on('click', '.diff', async (...args) => {
      await this.diffFile(args)
    })
    $(document).on('click', '.addgit', async (...args) => {
      await this.addToGit(args)
    })
  }

  // UI Elements

  async showspinner() {
    $("#spinner").modal('show');
  }

  async hidespinner() {
    $("#spinner").modal('hide');
  }

  async showtoast(str = '') {
    $('.toast-body').html(str)
    $('.toast').css('top', window.scrollY + window.innerHeight / 2)
    $('.toast').css('right', window.innerWidth / 2 - $('.toast').outerWidth() / 2)
    $('.toast').toast('show')
  }

  async addAlert(id, message, addToClearMessage = true, clearPreviousMessages = false) {
    if (clearPreviousMessages) $(".clearmessage").hide();
    $(`#${id}`).html(message).removeClass().addClass('alert').addClass('alert-danger').addClass('mt-2').show()
    if (addToClearMessage) $(`#${id}`).addClass('clearmessage')
  }

  async addInfo(id, message, addToClearMessage = false, clearPreviousMessages = false) {
    if (clearPreviousMessages) $(".clearmessage").hide();
    $(`#${id}`).html(message).removeClass().addClass('alert').addClass('alert-info').addClass('mt-2').show()
    if (addToClearMessage) $(`#${id}`).addClass('clearmessage')
  }

  async addSuccess(id, message, addToClearMessage = false, clearPreviousMessages = false) {
    if (clearPreviousMessages) $(".clearmessage").hide();
    $(`#${id}`).html(message).removeClass().addClass('alert').addClass('alert-success').addClass('mt-2').show()
    if (addToClearMessage) $(`#${id}`).addClass('clearmessage')
  }

  // IDE

  async enableCallBacks() {
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
      await this.rmFile(e)

    })

    this.client.on('fileManager', 'fileRenamed', async (e) => {
      // Do something
      console.log(e)
      await this.rmFile(e)
    })

    this.client.on('fileManager', 'fileAdded', async (e) => {
      // Do something
      console.log(e)
      await this.addFileFromBrowser(e)
    })
    this.callBackEnabled = true
  }

  async disableCallBacks() {
    this.callBackEnabled = false
  }

  // Git functions

  async gitinit() {
    console.log("init")
    const fs = this.fs
    try {
      await git.init({
        fs,
        dir: '/'
      })
      //await this.createBranch("master")
      // alert("git init done")
      this.showtoast('GIT initialized')
      await this.showFiles()
    } catch (e) {
      console.log(e)
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

  async gitrm(args) {
    console.log('RM GIT', $(args[0].currentTarget).data('file'))
    const filename = $(args[0].currentTarget).data('file')
    const fs = this.fs
    const added = await git.remove({
      fs,
      dir: '/',
      filepath: this.removeSlash(filename)
    })
    await this.showFiles()
    this.showtoast('added ', added)
  }

  async checkoutfile(args) {
    const filename = $(args[0].currentTarget).data('file')
    console.log("checkout", filename)
    let fs = this.fs
    try {
      await git.checkout({
        fs,
        dir: '/',
        ref: 'HEAD',
        filepaths: [`/${filename}`]
      })
    } catch (e) {
      console.log(e)
      //this.addAlert("checkoutMessage", e)
    }
    console.log('done')
    await this.syncToBrowser();
  }

  async checkout(args) {

    const oid = $(args[0].currentTarget).data('oid')
    console.log("checkout", oid)
    let fs = this.fs

    try {
      await git.checkout({
        fs,
        dir: '/',
        ref: oid
      })
    } catch (e) {
      console.log(e)
      this.addAlert("checkoutMessage", e)
    }
    console.log('done')
    await this.syncToBrowser();
  }

  // File functions

  async clearDb() {
    const req = indexedDB.deleteDatabase('remix-workspace')
    const me = this

    req.onsuccess = async function () {
      me.showtoast('Deleted database successfully')
      //await me.gitlog()
      //await me.showFiles()
      await me.gitinit()
    }
  }

  async addFileFromBrowser(file) {
    if (!this.callBackEnabled) return false
    const content = await this.client.call('fileManager', 'readFile', file)
    await this.addFile(file, content)
  }

  async syncToBrowser() {

    this.showspinner();
    await this.disableCallBacks();
    let filesToSync = []
    // first get files in current commit, not the files in the FS because they can be changed or unstaged
    const fs = this.fs
    let filescommited = await git.listFiles({
      fs,
      dir: '/',
      ref: 'HEAD'
    })
    const currentcommitoid = await this.getCommitFromRef("HEAD")
    for (let i = 0; i < filescommited.length; i++) {
      const ob = {
        path: filescommited[i],
        content: await this.getFileContentCommit(filescommited[i], currentcommitoid)
      }
      console.log("sync file", ob)
      try {
        await this.client.call('fileManager', 'setFile', ob.path, ob.content)
      } catch (e) {
        console.log("could not load file", e)
        this.hidespinner();
      }
      filesToSync.push(ob)
    }
    console.log("files to sync", filesToSync)

    await this.showFiles();
    await this.enableCallBacks();
    this.addSuccess('ipfsimportalert', 'Import successfull', true, true)
    this.hidespinner();
  }

  async addFile(file, content) {
    console.log('add file ', file)
    const directories = path.dirname(file)
    await this.createDirectoriesFromString(directories)
    await this.fsp.writeFile('/' + file, content)
    await this.showFiles()
  }

  async rmFile(file) {
    console.log('rm file ', file)
    await this.fsp.unlink('/' + file)
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
        // console.log(e)
      }
    }
  }

  async viewFile(args) {
    const filename = $(args[0].currentTarget).data('file')
    console.log($(args[0].currentTarget).data('file'))
    await this.client.call('fileManager', 'switchFile', `${this.removeSlash(filename)}`)
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
      ref: 'HEAD'
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
    //console.log('get directory')
    let result = []
    const files = await this.fsp.readdir(`${dir}`)
    //console.log('readdir', files)
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
        dir: true,
        file: false,
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
          dir: true,
          file: false,
          name: directories[i],
          fullname: finalPath,
          parentDir: path.dirname(finalPath)
        })
      }
      if (!ob.find((x) => {
          return x.fullname === files[i]
        })) ob.push({
        type: 'file',
        file: true,
        dir: false,
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
      f.parentId = null
      f.children = null
      if (f.type === 'file') {
        // f.parent

        const parent = ob.find((x) => {
          return (x.fullname === f.directory) && (x.type === 'dir')
        })
        f.parentId = parent ? parent.id : null
      } else {
        //console.log(f)
        const parent = ob.find((x) => {
          return (x.fullname === f.parentDir) && (x.type === 'dir')
        })
        f.parentId = parent ? parent.id : null
      }
    })
    console.log("build tree from", ob.sort(this.sortbydirectorylevel))
    // first we need it sorted
    const nest = (items, id = null, link = 'parentId') =>
      items
      .filter(item => item[link] === id)
      .map(item => ({
        ...item,
        children: nest(items, item.id)
      }));

    console.log("build tree from", ob)

    let t = nest(ob)

    // console.log('OB', ob)
    return {
      children: t
    }
  }



  sortbydirectorylevel(a, b) {
    //console.log(a,b);
    if (a.fullname.split("/").length < b.fullname.split("/").length) {
      return -1
    }
    if (a.fullname.split("/").length > b.fullname.split("/").length) {
      return 1
    }
    return 0;
  };

  removeSlash(s) {
    return s.replace(/^\/+/, '')
  }

  async clone() {

    const cid = $('#ipfs').val()
    console.log(cid)
    if (cid == "" || typeof cid == "undefined" || !cid) {
      return false
    }
    // return true;
    await this.clearDb()
    console.log("cloning")
    let connected = await this.setipfsHost()
    if (!connected) return false
    // try{
    //   for await (const file of this.ipfs.get(cid)) {
    //   }
    //   console.log("cid ok")
    // }catch(e){
    //   console.log(e)
    //   this.addAlert('ipfsimportalert', 'This IPFS cid is probably not correct....', true, true)
    //   return false
    // }
    try {
      for await (const file of this.ipfs.get(cid)) {
        file.path = file.path.replace(cid, '')
        console.log(file.path)
        if (!file.content) {
          //
          console.log("CREATE DIR", file.path)
          await this.createDirectoriesFromString(file.path)
          continue
        }
        console.log("CREATE FILE", file.path)
        const content = []
        for await (const chunk of file.content) {
          content.push(chunk)
        }
        await this.fsp.writeFile(file.path, content[0] || new Uint8Array())
      }
      await this.syncToBrowser()
    } catch (e) {
      this.addAlert('ipfsimportalert', 'This IPFS cid is probably not correct....', true, true)
    }
  }

  async showFiles() {
    $('#files').show()
    $('#diff-container').hide()
    let files = await this.getDirectory('/')
    console.log(files)
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
    try {
      await this.gitlog()

    } catch (e) {

    }
    try {
      await await this.getBranches()
    } catch (e) {

    }

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

  async getCommits() {
    console.log("get commits")
    try {
      let fs = this.fs
      const commits = await git.log({
        fs,
        dir: '/',
        depth: 200
      })

      commits.map((x) => {
        //console.log(x)
        x.date = new Date(x.commit.committer.timestamp * 1000).toString()
        // x.date = x.commit.committer.timestamp
        return x
        // $("#status").append(x.commit.message).append(x.oid).append("<br>");
      })
      console.log(commits)
      return commits
    } catch (e) {
      throw (e)
    }
  }

  async gitlog() {
    console.log("log")
    const fs = this.fs
    $('#status').empty()
    // console.log(fs);

    try {
      const commits = await this.getCommits()

      const template = require('./commits.html')
      const html = template.render({
        commits: commits
      })
      $('#status').html(html)
    } catch (e) {
      console.log(e)
      $('#status').html('Log is empty')
    }

    await this.showCurrentBranch()
  }

  async createBranch(name = false) {
    const fs = this.fs
    const branch = name || $("#newbranchname").val();
    if (branch)
      await git.branch({
        fs,
        dir: '/',
        ref: branch
      })
    this.showFiles();
  }

  async showCurrentBranch() {
    $('#init-btn').hide()
    $('.gitIsReady').show()

    try {
      const branch = await this.currentBranch()
      if (typeof branch === 'undefined') {
        this.addAlert('branch', `You are in a detached state`)
      } else {
        const currentcommitoid = await this.getCommitFromRef(branch)
        this.addSuccess('branch', `Branch is: ${branch} at commit ${currentcommitoid}`)
      }
      console.log('BRANCH', branch)
    } catch (e) {
      // this means git is not init
      //console.log(e)
      //$('#init-btn').show()
      //$('.gitIsReady').hide()
      this.addInfo('branch', 'There is no active branch. Add and commit files.')
      //await this.createBranch()
      //this.showtoast('No active branch')
    }
  }

  async getLastCommmit() {
    try {
      let currentcommitoid = ""
      const branch = await this.currentBranch()
      if (typeof branch !== 'undefined') {
        currentcommitoid = await this.getCommitFromRef(branch)
        return currentcommitoid
      }
    } catch (e) {
      return false
    }
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
      console.log('BRANCH', branch)
      return branch
    } catch (e) {
      throw (e)
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

  async getBranches() {
    let fs = this.fs
    let branches = await git.listBranches({
      fs,
      dir: '/'
    })
    let html = require('./branches.html')
    console.log(branches)
    $("#branches").html(html.render({
      "branches": branches
    }))
  }

  async getCommitFromRef(ref) {
    let fs = this.fs
    const commitOid = await git.resolveRef({
      fs,
      dir: '/',
      ref: ref
    })
    return commitOid
  }

  async getFileContentCommit(fullfilename, commitOid) {
    const fs = this.fs
    let content = ""
    try {
      const {
        blob
      } = await git.readBlob({
        fs,
        dir: '/',
        oid: commitOid,
        filepath: this.removeSlash(fullfilename)
      })
      content = Buffer.from(blob).toString('utf8')

    } catch (e) {
      console.log(e)
    }
    return content
  }

  async getipfsurl(){
    return  $("#IPFS-url").val() != "" ? $("#IPFS-url").val() : false || ipfsurl
  }

  async setipfsHost() {
    this.ipfs = IpfsHttpClient({
      host: $("#IPFS-host").val() != "" ? $("#IPFS-host").val() : false || defaultHost,
      port: $("#IPFS-host").val() != "" ? $("#IPFS-port").val() : false || defaultPort,
      protocol: $("#IPFS-protocol").val() != "" ? $("#IPFS-protocol").val() : false || defaultProtocol
    })
    try {
      await this.ipfs.config.getAll();

      return true
    } catch (e) {
      console.log("IPFS error", e);
      this.addAlert('ipfsAlert', 'There was an error connecting to IPFS, please check your IPFS settings if applicable.', true, false)
      this.addAlert('ipfsimportalert', 'There was an error connecting to IPFS, please check your IPFS settings if applicable.', true, false)
      this.hidespinner()
      return false
    }
  }

  async addToIpfs() {
    this.showspinner();
    this.filesToSend = []
    // first get files in current commit, not the files in the FS because they can be changed or unstaged
    const fs = this.fs
    let filescommited
    try {
      filescommited = await git.listFiles({
        fs,
        dir: '/',
        ref: 'HEAD'
      })
    } catch (e) {
      this.addAlert('ipfsAlert', 'No files commited', true, true)
      this.hidespinner()
      return false
    }
    const currentcommitoid = await this.getCommitFromRef("HEAD")
    for (let i = 0; i < filescommited.length; i++) {
      const ob = {
        path: filescommited[i],
        content: await this.getFileContentCommit(filescommited[i], currentcommitoid)
      }
      this.filesToSend.push(ob)
    }
    console.log(this.filesToSend)
    //return true;

    // then we get the git objects folder
    const files = await this.getDirectory('/.git')
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

    let connected = await this.setipfsHost()
    if (!connected) return false

    const addOptions = {
      wrapWithDirectory: true
    }
    try {
      await this.ipfs.add(this.filesToSend, addOptions).then((x) => {
        console.log(x.cid.string)
        /* $('#CID').attr('href', `${ipfsurl}${x.cid.string}`)
        $('#CID').html(`Your files are here: ${x.cid.string}`) */
        this.cid = x.cid.string
      })
      this.addSuccess('ipfsAlert', `You files were uploaded to IPFS: <a target=_blank href="${await this.getipfsurl()}${this.cid}">${this.cid}</a>`, true, true)
      this.hidespinner()
    } catch (e) {
      this.addAlert('ipfsAlert', 'There was an error uploading to IPFS, please check your IPFS settings if applicable.', true, true)
      this.showtoast('There was an error uploading to IPFS!')
      this.hidespinner()
      console.log(e)
    }

    return true
  }

  // 3BOX connection

  async connect3Box() {
    console.log("3box connect")
    this.showspinner();
    try {
      this.box = await Box.openBox(this.address, this.provider)
      this.space = await this.box.openSpace('remix-workspace')
      console.log(this.space)
      this.addSuccess("3boxconnection", `Your 3Box space is ${this.space._name}`);
      const hashes = await this.getHashesFrom3Box()
      await this.show3boxhashes(hashes)
    } catch (e) {
      this.addAlert("3boxconnection", `Can't connect to 3Box. Make sure the IDE runs on HTTPS.`, true, true);
    }
    this.hidespinner();
  }

  async storeHashIn3Box() {

    if (typeof this.space == "undefined") {
      await this.addAlert('boxexportstatus', "You should connect to 3Box first");
      return false;
    }
    this.showspinner()
    await this.addToIpfs()
    console.log('export 3box', this.cid, this.space)
    const commits = await this.getCommits()
    let key = `remixhash-${Date.now()}`
    await this.space.private.set(key, {
      "key": key,
      "cid": this.cid,
      "datestored": new Date(Date.now()),
      "datecommit": commits[0].date,
      "ref": commits[0].oid,
      "message": commits[0].commit.message
    })
    this.showtoast('stored in 3box')
    this.addSuccess('boxexportstatus', 'Your data was stored in 3Box')
    const hashes = await this.getHashesFrom3Box()
    await this.show3boxhashes(hashes)
    this.hidespinner()
  }

  async show3boxhashes(hashes) {
    console.log("render", hashes)
    const template = require('./3box.html')
    let ipfsurl = await this.getipfsurl()
    hashes.map(async (x) => {
      try {
        x.link = `${ipfsurl}${x.cid}`
        return x
      } catch (e) {
        return false
      }
    })

    hashes = hashes.reverse();
    const html = template.render({
      commits: hashes
    })
    $('#3boxhashes').html(html)
  }

  async getHashesFrom3Box() {
    const hashes = await this.space.private.all();
    console.log(hashes)
    return Object.values(hashes)
  }

  async importFrom3Box(args) {
    const cid = $(args[0].currentTarget).data('cid')
    console.log('cid', cid)
    this.cid = cid
    $('#ipfs').val(this.cid)
    await this.clone()
  }

  async deleteFrom3Box(args) {
    const key = $(args[0].currentTarget).data('key')
    console.log('key', key)
    this.showspinner()
    await this.space.private.remove(key)
    const hashes = await this.getHashesFrom3Box()
    await this.show3boxhashes(hashes)
    this.hidespinner()
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
        this.addSuccess("ethAddress", `Your eth address is ${this.address}`);
        await this.set3boxbuttonsStatus(false)
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

  async set3boxbuttonsStatus(status) {
    $(".3boxbtn").prop('disabled', status)
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