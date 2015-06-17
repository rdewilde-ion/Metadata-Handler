var util = require('util')
var FolderCapper = require('folder-capper')
var async = require('async')
var WebTorrent = require('webtorrent')
var events = require('events')
var utils = require('./utils')
// var torrent_tracker = require(__dirname + '/tracker')

var MetadataHandler = function (properties) {
  // Torrent setup
  this.announce = properties.client.announce
  this.urlList = properties.client.urlList

  // File system propeties
  this.dataDir = __dirname + properties.folders.data
  this.spvFolder = this.dataDir + properties.folders.spvData
  this.fullNodeFolder = this.dataDir + properties.folders.fullNodeData
  this.torrentDir = __dirname + properties.folders.torrents

  // Folder Capper Settings
  var options = {
    folderToClear: this.fullNodeFolder,
    ignores: properties.folders.ignores,
    folderToCap: this.dataDir,
    capSize: properties.folders.capSize,
    retryTime: properties.folders.retryTime
  }

  // Start the torrent Client
  this.client = new WebTorrent(properties.client)

  // Start the floder capper
  this.capper = new FolderCapper(options)
  var self = this
  this.capper.on('full', function (amountToClear) {
    console.log('Needs to clear: ', amountToClear, ' MB')
    self.capper.clear(function (err, results) {
      if (err) return console.error(err)
      return console.log(results)
    })
  })
  this.capper.startWatchMode(properties.folders.autoWatchInterval)
}

util.inherits(MetadataHandler, events.EventEmitter)

MetadataHandler.prototype.getMetadata = function (input, sha2, spv, cb) {
  var folderToSave = spv ? this.spvFolder : this.fullNodeFolder
  var opts = {
    announce: this.announce, // List of additional trackers to use (added to list in .torrent or magnet uri)
    path: folderToSave,      // Folder where files will be downloaded (default=`/tmp/webtorrent/`)
    verify: true             // Verify previously stored data before starting (default=false)
  }
  var self = this
  this.client.add(input, opts, function (torrent) {
    torrent.on('done', function () {
      utils.merge(torrent, function (err, metadata) {
        if (err) {
          self.emit('error', err)
          if (cb) cb(err)
        }
        if (sha2 && utils.getHash(metadata) !== sha2) {
          err = new Error(input + ' has failed hash test')
          self.emit('error', err)
          if (cb) cb(err)
          return
        }
        self.emit('downloads/' + input, metadata)
        self.emit('downloads', metadata)
        if (cb) cb(null, metadata)
      })
    })
  })
}

MetadataHandler.prototype.addMetadata = function (metadata, cb) {
  var sha2 = utils.getHash(metadata)
  var fileName = sha2.toString('hex')
  var self = this
  async.waterfall([
    function (callback) {
      utils.createNewMetaDataFile(metadata, fileName, self.spvFolder, callback)
    },
    function (result, callback) {
      result.torrentDir = self.torrentDir
      result.announce = self.announce
      result.urlList = self.urlList
      utils.createTorrentFromMetaData(result, callback)
    }
  ], function (err, result) {
    console.log(result)
    if (err) return cb(err)
    cb(null, {torrentHash: result.torrent.infoHash, sha2: sha2})
  })
}

MetadataHandler.prototype.shareMetadata = function (fileHash, spv, cb) {
  if (typeof spv === 'function') {
    cb = spv
    spv = true
  }

  var torrentFilePath = this.torrentDir + '/' + fileHash + '.torrent'

  utils.getFilePathFromTorrent(torrentFilePath, function (dataFilePath) {
    this.client.seed(dataFilePath, function (torrent) {
    // Client is seeding the file!
    // console.log('Torrent info hash:', torrent.infoHash)
  })
}

// this.emit('downloads', err, metadata)
// this.emit('downloads/' + torrentHash, err, peer)
// this.emit('uploads', err, peer)
// this.emit('uploads/' + torrentHash, err, metadata)

// MetadataHandler.prototype.start = function (cb) {
//   var self = this
//   async.waterfall([
//     function (callback) {
//       var options = {
//         folderToClear: self.fullNodeFolder,
//         ignores: self.properties.folders.ignore,
//         folderToCap: self.dataDir,
//         capSize: self.capSize,
//         retryTime: self.properties.folders.diskNotReadyRetryTime,
//         autoWatchInterval: self.properties.folders.autoWatchInterval
//       }
//       self.capper = new FolderCapper(options)

//       self.capper.clear(callback)
//     },
//     function (junkResult, callback) {
//       logger.debug('Pre Folders Cleaning results: ' + util.inspect(junkResult))
//       torrent_tracker(self.properties, callback)
//     },
//     function (tracker, callback) {
//       self.tracker = tracker
//       logger.debug('Tracker listening on http port:' + tracker.http.address().port)
//       logger.debug('Tracker listening on udp port:' + tracker.udp.address().port)
//       logger.debug('Tracker listening on ws port:' + tracker.ws.options.port)
//       var handleTorrent = saveTorrentToFolder(self.dataDir + '/test/', self.maxConns)
//       // logger.debug(self.torrentDir)
//       // self.peers = []
//       fs.readdirSync(self.torrentDir).forEach(function (file) {
//         var fileSplit = file.split('.')
//         if (fileSplit[1] === 'torrent') {
//           // logger.debug(fileSplit[0])
//           var torrent = fs.readFileSync(self.torrentDir + '/' + file)
//           self.client.add(torrent, handleTorrent)
//         }
//       })
//       var testMag = 'magnet:?xt=urn:btih:5ADD2B0CE8F7DA372C856D4EFE6B9B6E8584919E&dn=taylor+swift+shake+it+off+2014+pop&tr=http%3A%2F%2Ftracker.ex.ua%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337'
//       // var testMag = 'magnet:?xt=urn:btih:1eb7cc4083efa26eda476e563c28b7238c5f3683&dn=GIRLS+DO+PORN+-+18+Years+Old+-+Her+First+Hard+Fuck+HD+720p&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=udp%3A%2F%2Fopen.demonii.com%3A1337&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Fexodus.desync.com%3A6969'
//       self.client.add(testMag, handleTorrent)

//       callback(null, tracker)
//     }], function (err, tracker) {
//       if (err) return cb(err)
//       return cb(null, self)
//     }
//   )
// }

module.exports = MetadataHandler