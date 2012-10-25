/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var App = require('app');
var db = require('utils/db');

/**
 * By Step 6, we have the following information stored in App.db and set on this
 * controller by the router:
 *
 *   hosts: App.db.hosts (list of all hosts the user selected in Step 3)
 *   selectedServiceNames: App.db.selectedServiceNames (the services that the user selected in Step 4)
 *   masterComponentHosts: App.db.masterComponentHosts (master-components-to-hosts mapping the user selected in Step 5)
 *
 * Step 6 will set the following information in App.db:
 *   hostSlaveComponents: App.db.hostSlaveComponents (hosts-to-slave-components mapping the user selected in Steo 6)
 *   slaveComponentHosts: App.db.slaveComponentHosts (slave-components-to-hosts mapping the user selected in Step 6)
 *
 */
App.InstallerStep6Controller = Em.Controller.extend({


  hosts: [],
  // TODO: hook up with user host selection
  rawHosts: [],
  selectedServiceNames: [],
  showHbase: false,
  showTaskTracker: false,

  hasMasterComponents: function (hostname) {
    var hasMaster = false;
    var masterComponentHosts = db.getMasterComponentHosts();
    return masterComponentHosts.someProperty('hostName', hostname);
  },

  isAllDataNodes: function () {
    return this.get('hosts').everyProperty('isDataNode', true);
  }.property('hosts.@each.isDataNode'),

  isAllTaskTrackers: function () {
    return this.get('hosts').everyProperty('isTaskTracker', true);
  }.property('hosts.@each.isTaskTracker'),

  isAllRegionServers: function () {
    return this.get('hosts').everyProperty('isRegionServer', true);
  }.property('hosts.@each.isRegionServer'),

  isAllClients: function () {
    return this.get('hosts').everyProperty('isClient', true);
  }.property('hosts.@each.isClient'),

  isNoDataNodes: function () {
    return this.get('hosts').everyProperty('isDataNode', false);
  }.property('hosts.@each.isDataNode'),

  isNoTaskTrackers: function () {
    return this.get('hosts').everyProperty('isTaskTracker', false);
  }.property('hosts.@each.isTaskTracker'),

  isNoRegionServers: function () {
    return this.get('hosts').everyProperty('isRegionServer', false);
  }.property('hosts.@each.isRegionServer'),

  isNoClients: function () {
    return this.get('hosts').everyProperty('isClient', false);
  }.property('hosts.@each.isClient'),

  isHbaseSelected: function () {
    var services = db.getSelectedServiceNames();
    return this.get('selectedServiceNames').contains('HBASE');
  },

  isMrSelected: function () {
    return this.get('selectedServiceNames').contains('MAPREDUCE');
  }.property('selectedServiceNames'),

  clearError: function () {
    if (this.get('isNoDataNodes') === false && (this.get('isNoTaskTrackers') === false || this.get('isMrSelected') ===
      false) && (this.get('isNoRegionServers') === false || this.isHbaseSelected() === false) && this.get('isNoClients')
      === false) {
      this.set('errorMessage', '');
    }
  }.observes('isNoDataNodes', 'isNoTaskTrackers', 'isNoRegionServers', 'isNoClients'),

  selectAllDataNodes: function () {
    this.get('hosts').setEach('isDataNode', true);
  },

  selectAllTaskTrackers: function () {
    this.get('hosts').setEach('isTaskTracker', true);
  },

  selectAllRegionServers: function () {
    this.get('hosts').setEach('isRegionServer', true);
  },

  selectAllClients: function () {
    this.get('hosts').setEach('isClient', true);
  },

  deselectAllDataNodes: function () {
    this.get('hosts').setEach('isDataNode', false);
  },

  deselectAllTaskTrackers: function () {
    this.get('hosts').setEach('isTaskTracker', false);
  },

  deselectAllRegionServers: function () {
    this.get('hosts').setEach('isRegionServer', false);
  },

  deselectAllClients: function () {
    this.get('hosts').setEach('isClient', false);
  },

  clearStep: function () {
    this.set('hosts', []);
    this.set('selectedServiceNames', []);
    this.clearError();
  },

  loadStep: function () {
    console.log("TRACE: Loading step6: Assign Slaves");
    this.clearStep();
    this.set('selectedServiceNames', db.getSelectedServiceNames());
    this.set('showHbase', this.isHbaseSelected());
    this.set('showTaskTracker', this.get('isMrSelected'));
    this.setSlaveHost(this.getSlaveHosts());
  },

  getHostNames: function () {
    var hostInfo = db.getHosts();
    var hostNames = [];
    for (var index in hostInfo) {
      if (hostInfo[index].bootStatus === 'success')
        hostNames.push(hostInfo[index].name);
    }
    return hostNames;
  },

  getSlaveHosts: function () {
    var hostObjs = new Ember.Set();
    var allHosts = this.getHostNames();
    var slaveHosts = App.db.getSlaveComponentHosts();
    if (slaveHosts === undefined || slaveHosts === null) {
      allHosts.forEach(function (_hostname) {
        var hostObj = Ember.Object.create({
          hostname: _hostname,
          isMaster: this.hasMasterComponents(_hostname),
          isDataNode: !this.hasMasterComponents(_hostname),
          isTaskTracker: !this.hasMasterComponents(_hostname),
          isRegionServer: !this.hasMasterComponents(_hostname),
          isClient: false
        });
        hostObjs.add(hostObj);
      }, this);
      if (hostObjs.someProperty('isDataNode', true)) {
        hostObjs.findProperty('isDataNode', true).set('isClient', true);
      }

    } else {
      allHosts.forEach(function (_hostName) {
        hostObjs.add(Ember.Object.create({
          hostname: _hostName,
          isMaster: false,
          isDataNode: false,
          isTaskTracker: false,
          isRegionServer: false,
          isClient: false
        }));
      }, this);
      var datanodes = slaveHosts.findProperty('componentName', 'DATANODE');
      datanodes.hosts.forEach(function (_datanode) {
        var datanode = hostObjs.findProperty('hostname', _datanode.hostname);
        if (datanode) {
          datanode.set('isDataNode', true);
        }
      }, this);
      if (this.get('isMrSelected')) {
        var taskTrackers = slaveHosts.findProperty('componentName', 'TASKTRACKER');
        taskTrackers.hosts.forEach(function (_taskTracker) {
          var taskTracker = hostObjs.findProperty('hostname', _taskTracker.hostname);
          if (taskTracker) {
            taskTracker.set('isTaskTracker', true);
          }
        }, this);
      }
      if (this.isHbaseSelected()) {
        var regionServers = slaveHosts.findProperty('componentName', 'HBASE_REGIONSERVER');
        regionServers.hosts.forEach(function (_regionServer) {
          var regionServer = hostObjs.findProperty('hostname', _regionServer.hostname);
          if (regionServer) {
            regionServer.set('isRegionServer', true);
          }
        }, this);
      }
      var clients = slaveHosts.findProperty('componentName', 'CLIENT');
      clients.hosts.forEach(function (_client) {
        var client = hostObjs.findProperty('hostname', _client.hostname);
        if (client) {
          client.set('isClient', true);
        }
      }, this);
      allHosts.forEach(function (_hostname) {
        var host = hostObjs.findProperty('hostname', _hostname);
        if (host) {
          host.set('isMaster', this.hasMasterComponents(_hostname));
        }
      }, this);

    }
    return hostObjs;
  },

  getMasterComponentsforHost: function (hostname) {
    if (App.db.getHostToMasterComponent().someProperty('hostname', hostname)) {
      return App.db.getHostToMasterComponent().findProperty('hostname', hostname).components;
    } else {
      return false;
    }
  },

  setSlaveHost: function (hostObj) {
    hostObj.forEach(function (_hostObj) {
      this.get('hosts').pushObject(_hostObj);
    }, this);
  },

  validate: function () {
    return !(this.get('isNoDataNodes') || this.get('isNoClients') || (this.get('isMrSelected') &&
      this.get('isNoTaskTrackers')) || (this.isHbaseSelected() && this.get('isNoRegionServers')));
  },

  submit: function () {
    if (!this.validate()) {
      this.set('errorMessage', Ember.I18n.t('installer.step6.error.mustSelectOne'));
      return;
    }
    App.db.setHostSlaveComponents(this.get('host'));

    var dataNodeHosts = [];
    var taskTrackerHosts = [];
    var regionServerHosts = [];
    var clientHosts = [];

    this.get('hosts').forEach(function (host) {
      if (host.get('isDataNode')) {
        dataNodeHosts.pushObject({
          hostname: host.hostname,
          group: 'Default'
        });
      }
      if (this.get('isMrSelected') && host.get('isTaskTracker')) {
        taskTrackerHosts.push({
          hostname: host.hostname,
          group: 'Default'
        });
      }
      if (this.isHbaseSelected() && host.get('isRegionServer')) {
        regionServerHosts.pushObject({
          hostname: host.hostname,
          group: 'Default'
        });
      }
      if (host.get('isClient')) {
        clientHosts.pushObject({
          hostname: host.hostname,
          group: 'Default'
        });
      }
    }, this);

    var slaveComponentHosts = [];
    slaveComponentHosts.pushObject({
      componentName: 'DATANODE',
      displayName: 'DataNode',
      hosts: dataNodeHosts
    });
    if (this.get('isMrSelected')) {
      slaveComponentHosts.pushObject({
        componentName: 'TASKTRACKER',
        displayName: 'TaskTracker',
        hosts: taskTrackerHosts
      });
    }
    if (this.isHbaseSelected()) {
      slaveComponentHosts.pushObject({
        componentName: 'HBASE_REGIONSERVER',
        displayName: 'RegionServer',
        hosts: regionServerHosts
      });
    }
    slaveComponentHosts.pushObject({
      componentName: 'CLIENT',
      displayName: 'client',
      hosts: clientHosts
    });

    App.db.setSlaveComponentHosts(slaveComponentHosts);
    App.router.send('next');

  }

})
;