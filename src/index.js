
// import { Remix3BoxPlugin } from './remix-3box-plugin';

import { SpacePlugin } from './spaces-plugin';
import { WorkSpacePlugin } from './workspace-plugin';
import IpfsHttpClient from 'ipfs-http-client'

//const plugin = new SpacePlugin(); // instantiate the plugin
const workspace = new WorkSpacePlugin();



// function ipfs(){
//     const defaultHost = 'ipfs.komputing.org' // ethdev berlin ipfs node
//     const defaultPort = 443
//     const defaultProtocol = 'https'
//     let ipfs = IpfsHttpClient(
//         {host:defaultHost,port:defaultPort,protocol:defaultProtocol}
//     )

//     let i =  ipfs.add({
//         path:"/tuts/yann.txt",
//         content:"genius",
//         mode:"string"
//     }).then((x)=>console.log(x))
// }




// plugin.onload(()=>{
//     plugin.eventEmitter.on('ipfs', function (data) {
//         ipfs()
//     });
// })


