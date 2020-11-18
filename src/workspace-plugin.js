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

const defaultHost = 'localhost' // ethdev berlin ipfs node
const defaultPort = 5001
const defaultProtocol = 'http'
const ipfsurl = "https://ipfs.io/ipfs/";

export class WorkSpacePlugin extends PluginClient {


  constructor() {

    super();

    this.filesToSend = [];
    this.fs = new FS("remix-workspace"); // INDEXEDDB NAME
    this.fsp = this.fs.promises;

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
      await this.setFileSystem()
    })
    $("#clone-btn").click(async () => {
      await this.clone()
    })
    $("#status-btn").click(async () => {
      await this.status()
    })
    $("#addfile-btn").click(async () => {
      await this.addFile()
    })
    $(document).on("click", ".viewfile", async (...args) => {
      await this.viewFile(args)
    })
    $(document).on("click", ".addgit", async (...args) => {
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
      alert("added");
    })
    console.log("app started")

    // REMIX CLIENT 
    // this.client = createClient(this)
    // this.client.onload().then(async () => {

    //   console.log("workspace client loaded", this)
    //   //await this.getFilesFromIde()
    //   await this.setFileSystem()
    // });


    // IPFS HOST


    this.ipfs = IpfsHttpClient({
      host: defaultHost,
      port: defaultPort,
      protocol: defaultProtocol
    })



    return undefined
  }

  async clearDb() {
    var req = indexedDB.deleteDatabase("remix-workspace");
    req.onsuccess = function () {
      alert("Deleted database successfully");
    };
  }

  async gitinit() {
    let fs = this.fs;
    await git.init({
      fs,
      dir: "/"
    })
    alert("git init done")

  }

  async addFile() {


    await this.fsp.writeFile(`/${$("#filename").val()}`, $("#filecontent").val());
    await this.showFiles();
    alert("file added");
  }

  async viewFile(args) {
    console.log($(args[0].currentTarget).data("file"));
    let content = await this.fsp.readFile($(args[0].currentTarget).data("file"), {
      encoding: 'utf8'
    })
    $("#fileviewer").find("#filecontent").val(content);
    $('#fileviewer').modal('show')
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

    await this.status();
  }

  async showFiles() {

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

  async status() {

    let fs = this.fs;
    console.log(fs);

    let commits = await git.log({
      fs,
      dir: '/',
      depth: 5
    })
    $("#status").empty();
    commits.map((x) => {
      $("#status").append(x.commit.message).append("<br>");
    })
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
    alert(`commited ${sha}`)
    await this.status();
  }

  async setFileSystem() {

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
    });

    return true
    // fs = new FS("remix-workspace");
    // let fsp = fs.promises;
    // // this.fspromises = this.fs.promises;
    // let dir = '/tutorial'
    // // console.log(dir);
    // try {
    //   await fsp.mkdir(dir);
    // } catch (err) {
    //   console.log(err)
    // }
    // // // Behold - it is empty!
    // let files = await fsp.readdir(`${dir}/.git`);
    // console.log(files)
    // files = await fsp.stat(`${dir}/.git`);
    // console.log(files)
    // files = await fsp.lstat(`${dir}/.git`);
    // console.log(files)
    // // //this.fspromises = this.fs.promises;




    // try {
    //   await fsp.mkdir(`${dir}/test`);
    // } catch (err) {
    //   console.log(err)
    // }

    // await fsp.writeFile(`${dir}/test/yann2.txt`, "is a genius" + Math.random());

    // await git.init({
    //   fs,
    //   dir: dir
    // })
    // await git.add({
    //   fs,
    //   dir: '/tutorial',
    //   filepath: "yann.txt"
    // })
    // await git.add({
    //   fs,
    //   dir: '/tutorial/test',
    //   filepath: "yann2.txt"
    // })

    // let status = await git.status({
    //   fs,
    //   dir: '/tutorial',
    //   filepath: 'yann.txt'
    // })
    // console.log(status)

    // // All the files in the previous commit
    // //files = await git.listFiles({ fs, dir: '/tutorial', ref: 'HEAD' })
    // //console.log(files)
    // // All the files in the current staging area
    // files = await git.listFiles({
    //   fs,
    //   dir: '/tutorial'
    // })
    // console.log(files)

    // let sha = await git.commit({
    //   fs,
    //   dir: '/tutorial',
    //   author: {
    //     name: 'Mr. Test',
    //     email: 'mrtest@example.com',
    //   },
    //   message: 'Added the a.txt file'
    // })
    // console.log("SHA", sha)

    // let commits = await git.log({
    //   fs,
    //   dir: '/tutorial',
    //   depth: 5,
    //   ref: 'HEAD'
    // })
    // console.log(commits)

    // await fsp.writeFile(`${dir}/yann.txt`, "is a genius" + Math.random());

    // status = await git.status({
    //   fs,
    //   dir: '/tutorial',
    //   filepath: 'yann.txt'
    // })
    // console.log(status)

    // files = await git.listFiles({
    //   fs,
    //   dir: '/tutorial'
    // })
    // console.log(files)

    // let {
    //   packfile
    // } = await git.packObjects({
    //   fs,
    //   dir: '/tutorial',
    //   oids: [sha],
    //   write: false
    // })
    // console.log(this.Decodeuint8arr(packfile))

    /*     sha = await git.resolveRef({
          fs,
          dir: '/tutorial',
          ref: 'HEAD'
        })
        console.log(sha)
        let commit = await git.readCommit({
          fs,
          dir: '/tutorial',
          oid: sha
        })
        console.log(commit) */

    // files = await  fsp.readdir(`${dir}/.git`);

    // console.log(files)

    // await this.fspromises.writeFile(`${dir}/yann.txt`,"is a genius",{},(x)=>{console.log(x)});
    // console.log(this.fspromises);
    // console.log(git);
    // let promises = this.fspromises



  }
}