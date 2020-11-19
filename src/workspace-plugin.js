import {
  createClient
} from '@remixproject/plugin-webview';
import {
  PluginClient
} from '@remixproject/plugin';
import {
  default as Box
} from '3box';
import {
  getAddress
} from '@ethersproject/address';
import $ from 'jquery';
import git, {
  FsClient,
  PromiseFsClient
} from 'isomorphic-git'
import FS from '@isomorphic-git/lightning-fs';
import EventEmitter from 'events'
import IpfsHttpClient from 'ipfs-http-client'
import httpclient from 'isomorphic-git/http/web/index'
import path from 'path'
import CodeMirror from 'codemirror/lib/codemirror.js';
import {
  Diff,
  diffLines,
  diffChars,
  createPatch
} from 'diff';
import * as Diff2Html from 'diff2html';
import WalletConnectProvider from "@walletconnect/web3-provider";
import Web3Modal from "web3modal";

const defaultHost = 'localhost' // ethdev berlin ipfs node
const defaultPort = 5001
const defaultProtocol = 'http'
const ipfsurl = "https://ipfs.io/ipfs/";
export class WorkSpacePlugin extends PluginClient {

  constructor() {
    console.clear();
    super();

    this.fileeditor = CodeMirror.fromTextArea(document.getElementById('editor'), {
      lineNumbers: true,
    });
    this.fileeditor.setValue("ready...")

    this.newfileeditor = CodeMirror.fromTextArea(document.getElementById('newfileditor'), {
      lineNumbers: true
    });
    this.newfileeditor.setValue("add your content here")

    this.filesToSend = [];

    // This inits a IndexedDB database
    this.fs = new FS("remix-workspace");
    this.fsp = this.fs.promises;


    console.log("app started")

    // REMIX CLIENT 
    this.client = createClient(this)
    this.client.onload().then(async () => {

      console.log("workspace client loaded", this)
      //await this.getFilesFromIde()
      //await this.addToIpfs()
      await this.gitinit()
    });

    this.setClickHandlers();
    // IPFS HOST


    this.ipfs = IpfsHttpClient({
      host: defaultHost,
      port: defaultPort,
      protocol: defaultProtocol
    })

    this.showFiles();

    return undefined
  }

  async setClickHandlers() {
    // UI CLICK HANDLERS
    $("#files-btn").click(async () => {
      await this.showFiles()
    })
    $("#clear-btn").click(async () => {
      await this.clearDb()
    })
    $("#init-btn").click(async () => {
      await this.gitinit()
    })
    $("#commit-btn").click(async () => {
      await this.commit()
    })
    $("#main-btn").click(async () => {
      await this.addToIpfs()
    })
    $("#clone-btn").click(async () => {
      await this.clone()
    })
    $("#status-btn").click(async () => {
      await this.log()
    })
    $("#addfile-btn").click(async () => {
      await this.addFile()
    })
    $("#savefile-btn").click(async () => {
      await this.saveFile()
    })
    $("#wallet-btn").click(async () => {
      await this.openModal()
    })
    $("#3box-btn").click(async () => {
      await this.connect3Box()
    })
    $("#3boxExport-btn").click(async () => {
      await this.storeHashIn3Box()
    })
    $("#import3b-btn").click(async () => {
      await this.importFrom3Box()
    })

    $(document).on("click", ".viewfile", async (...args) => {
      await this.viewFile(args)
    })
    $(document).on("click", ".diff", async (...args) => {
      await this.diffFile(args)
    })
    $(document).on("click", ".addgit", async (...args) => {
      await this.addToGit(args)
    })
  }

  async showtoast(str=""){
    $(".toast").css("top",window.scrollY);
    $('.toast').toast('show')
    $('.toast-body').html(str)
  }

  async clearDb() {
    var req = indexedDB.deleteDatabase("remix-workspace");
    let me = this;
    
    req.onsuccess = async function () {
      this.showtoast("Deleted database successfully");
      await me.log();
      await me.showFiles();
    };
  }

  async gitinit() {
    let fs = this.fs;
    await git.init({
      fs,
      dir: "/"
    })
    //alert("git init done")
    this.showtoast("GIT initialized");
  }

  async addFile() {

    await this.fsp.writeFile(`/${$("#filename").val()}`, this.newfileeditor.getValue());
    await this.showFiles();
    this.showtoast("file added");
  }

  async viewFile(args) {
    let filename = $(args[0].currentTarget).data("file");
    console.log($(args[0].currentTarget).data("file"));
    let content = await this.fsp.readFile(filename, {
      encoding: 'utf8'
    })
    $("#files").hide();
    $("#diff-container").hide();
    $("#editor-container").show();
    this.fileeditor.setValue(content)
    $("#editorfile").html(filename);
    //$('#fileviewer').modal('show')

  }

  async saveFile() {
    let filename = $("#editorfile").html();
    let content = this.fileeditor.getValue()
    await this.fsp.writeFile(filename, content)
    await this.showFiles()
    $("#editor-container").hide();
  }

  async addToGit(args) {
    console.log($(args[0].currentTarget).data("file"));
    let filename = $(args[0].currentTarget).data("file");
    let content = await this.fsp.readFile(filename, {
      encoding: 'utf8'
    })
    let basename = path.basename(filename);
    let directory = path.dirname(filename)
    console.log(basename, directory)
    let fs = this.fs;
    await git.add({
      fs,
      dir: directory,
      filepath: basename
    })
    await this.showFiles();
    this.showtoast("added");
  }

  async diffFile(args) {
    $("#files").hide();
    $("#diff-container").show();
    let fs = this.fs
    let fullfilename = $(args[0].currentTarget).data("file");
    let filename = path.basename($(args[0].currentTarget).data("file"))
    let commitOid = await git.resolveRef({
      fs,
      dir: '/',
      ref: 'HEAD'
    })
    console.log(commitOid)
    let {
      blob
    } = await git.readBlob({
      fs,
      dir: '/',
      oid: commitOid,
      filepath: filename
    })

    let original = await this.fsp.readFile(fullfilename, {
      encoding: 'utf8'
    })
    let newcontent = Buffer.from(blob).toString('utf8');
    console.log(newcontent, original)
    let filediff = createPatch(filename, original, newcontent) //diffLines(original,newcontent)

    console.log(filediff)

    let diffview = Diff2Html.html(filediff)
    $("#diffviewer").html(diffview)

  }

  async getDirectory(dir) {

    let result = [];
    let files = await this.fsp.readdir(`${dir}`);
    //await files.map(async (fi)=>{
    for (let i = 0; i < files.length; i++) {
      let fi = files[i];
      if (typeof fi != "undefined") {
        console.log("looking into ", fi, dir);
        let type = await this.fsp.stat(`${dir}/${fi}`)
        if (type.type == "dir") {
          console.log("is directory, so get ", `${dir}/${fi}`);
          result = [...result, ...await this.getDirectory(`${dir}/${fi}`)]
        } else {
          console.log("is file ", `${dir}/${fi}`);
          result.push(`${dir}/${fi}`);
        }
      }
    }

    //})
    return result;
  }

  async clone() {
    await this.clearDb()
    const cid = $("#ipfs").val();
    console.log(cid);
    //return true;

    for await (const file of this.ipfs.get(cid)) {

      file.path = file.path.replace(cid, "");
      console.log(file.path)
      if (!file.content) {
        //
        if (file.path != "" && file.path != ".") {
          console.log("create dir", file.path)
          await this.fsp.mkdir(file.path)
        }
        continue;
      }
      console.log(file.content)
      const content = []
      for await (const chunk of file.content) {
        content.push(chunk)
      }
      console.log("create file", file.path)
      console.log(content[0])
      await this.fsp.writeFile(file.path, content[0])
    }

    await this.log();
  }

  async showFiles() {
    $("#files").show();
    $("#diff-container").hide();
    let files = await this.getDirectory("/");
    files = files.filter((element, index, array) => {
      console.log(element)
      return (element.indexOf(".git") == -1);
    }).map((x) => {
      return {
        name: x,
        filename: path.basename(x),
        directory: path.dirname(x),
        status: []
      }
    })

    const matrix = (await git.statusMatrix({
      fs: this.fs,
      dir: "/"
    })).map((x) => {
      return {
        filename: x.shift(),
        status: x
      }
    })

    const statusmatrix = [
      ["new, untracked", 0, 2, 0], // new, untracked
      ["added, staged", 0, 2, 2], // 
      ["added, staged, with unstaged changes", 0, 2, 3], // added, staged, with unstaged changes
      ["unmodified", 1, 1, 1], // unmodified
      ["modified, unstaged", 1, 2, 1], // modified, unstaged
      ["modified, staged", 1, 2, 2], // modified, staged
      ["modified, staged, with unstaged changes", 1, 2, 3], // modified, staged, with unstaged changes
      ["deleted, unstaged", 1, 0, 1], // deleted, unstaged
      ["deleted, staged", 1, 0, 0], // deleted, staged
    ].map((x) => {
      return {
        matrix: x.shift().split(","),
        status: x
      }
    })

    console.log(statusmatrix);
    console.log(matrix)
    matrix.map((m) => {
      files.map((f) => {
        (f.filename == m.filename) ? f.status = m.status: false
        statusmatrix.map((sm) => {
          console.log(sm, f, JSON.stringify(sm.status), JSON.stringify(f.status))
          if (JSON.stringify(sm.status) == JSON.stringify(f.status)) {
            f.status = sm.matrix
          }

        })
        return f
      })
    })



    console.log("files", files)


    // render files
    $("#files").empty();
    var template = require('./files.html');
    var html = template({
      files: files
    });
    $("#files").html(html);

  }

  async getFilesFromIde() {
    const files = await this.client.call('fileManager', 'readdir', 'browser');
    console.log(files)
    var filelist = [];
    Object.keys(files).map(function (key, index) {
      filelist.push(key)
    });
    var template = require('./files.html');
    var html = template({
      files: filelist
    });
    $("#fileList").html(html);
  }

  Decodeuint8arr(uint8array) {
    return new TextDecoder("utf-8").decode(uint8array);
  }

  async log() {

    let fs = this.fs;
    $("#status").empty();
    console.log(fs);

    let commits = await git.log({
      fs,
      dir: '/',
      depth: 5
    })

    commits.map((x) => {
      console.log(x)
      x.date = new Date(x.commit.committer.timestamp).toString()
      //$("#status").append(x.commit.message).append(x.oid).append("<br>");
    })

    var template = require('./commits.html');
    var html = template({
      commits: commits
    });
    $("#status").html(html);


  }

  async commit() {
    let fs = this.fs
    let sha = await git.commit({
      fs,
      dir: '/',
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
      },
      message: $("#message").val()
    })
    this.showtoast(`commited ${sha}`)
    await this.log();
  }

  async addToIpfs() {

    this.filesToSend = [];
    let files = await this.getDirectory("/");
    console.log("files to send", files, files.length);
    for (let i = 0; i < files.length; i++) {
      let fi = files[i];
      console.log("fetching ", fi)
      let ob = {
        path: fi,
        content: await this.fsp.readFile(fi)
      };
      this.filesToSend.push(ob);

    }
    let i;
    const addOptions = {
      wrapWithDirectory: true,
    };

    this.ipfs.add(this.filesToSend, addOptions).then((x) => {
      console.log(x.cid.string)
      $("#CID").attr("href", `${ipfsurl}${x.cid.string}`);
      $("#CID").html(x.cid.string);
      this.cid = x.cid.string;
    });

    return true
  }

  // 3BOX connection

  async connect3Box() {
    this.box = await Box.openBox(this.address, this.provider);
    this.space = await this.box.openSpace("remix-workspace");
    console.log(this.space)
  }

  async storeHashIn3Box() {
    console.log("export 3box", this.cid, this.space)
    await this.space.private.set("cid", this.cid)
    this.showtoast("stored in 3box")
  }

  async importFrom3Box() {
    let cid = await this.space.private.get("cid")
    console.log("cid", cid)
    this.cid = cid;
    $("#ipfs").val(this.cid);
    await this.clone();
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
        const [address] = await this.provider.enable();
        this.address = getAddress(address);
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
      });
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
    };
    return providerOptions;
  };
}