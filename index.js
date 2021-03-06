'use strict';

import React from 'react';
import {
  Image,
  Dimensions,
  Linking,
  NativeModules,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Expo from 'expo';
import jasmineModule from 'jasmine-core/lib/jasmine-core/jasmine';
import Immutable from 'immutable';

let { ExponentTest } = NativeModules;

// List of all modules for tests. Each file path must be statically present for
// the packager to pick them all up.
const testModules = [
  // require('./Tests/Basic1'),
  // require('./Tests/Basic2'),
  require('./Tests/Import1'),
  require('./Tests/Import2'),
  require('./Tests/Import3'),
  require('./Tests/Asset'),
  require('./Tests/Constants'),
  require('./Tests/Contacts'),
  require('./Tests/Location'),
  require('./Tests/SQLite'),
];

class App extends React.Component {
  // --- Lifecycle -------------------------------------------------------------

  constructor(props, context) {
    super(props, context);
    this.state = App.initialState;
    this._results = '';
    this._scrollViewRef = null;
  }

  componentDidMount() {
    this._runTests(this.props.exp.initialUri);
    Linking.addEventListener('url', ({ url }) => url && this._runTests(url));
  }

  // --- Test running ----------------------------------------------------------

  static initialState = {
    state: Immutable.fromJS({
      suites: [],
      path: ['suites'], // Path to current 'children' List in state
    }),
  };

  async _runTests(uri) {
    // Reset results state
    this.setState(App.initialState);

    const { jasmineEnv, jasmine } = await this._setupJasmine();

    // Load tests, confining to the ones named in the uri
    let modules = testModules;
    if (uri && uri.indexOf(Expo.Constants.linkingUri) === 0) {
      const deepLink = uri.substring(Expo.Constants.linkingUri.length);
      const regex = new RegExp(deepLink);
      console.log('regex:', deepLink);
      modules = modules.filter(m => regex.test(m.name));
    }
    modules.forEach(m => m.test(jasmine));

    jasmineEnv.execute();
  }

  async _setupJasmine() {
    // Init
    jasmineModule.DEFAULT_TIMEOUT_INTERVAL = 10000;
    const jasmineCore = jasmineModule.core(jasmineModule);
    const jasmineEnv = jasmineCore.getEnv();

    // Add our custom reporters too
    jasmineEnv.addReporter(this._jasmineSetStateReporter());
    jasmineEnv.addReporter(this._jasmineConsoleReporter());

    // Get the interface and make it support `async ` by default
    const jasmine = jasmineModule.interface(jasmineCore, jasmineEnv);
    const doneIfy = fn => async done => {
      try {
        await Promise.resolve(fn());
        done();
      } catch (e) {
        done.fail(e);
      }
    };
    const oldIt = jasmine.it;
    jasmine.it = (desc, fn, t) => oldIt.apply(jasmine, [desc, doneIfy(fn), t]);
    const oldXit = jasmine.xit;
    jasmine.xit = (desc, fn, t) =>
      oldXit.apply(jasmine, [desc, doneIfy(fn), t]);
    const oldFit = jasmine.fit;
    jasmine.fit = (desc, fn, t) =>
      oldFit.apply(jasmine, [desc, doneIfy(fn), t]);

    return {
      jasmineCore,
      jasmineEnv,
      jasmine,
    };
  }

  // A jasmine reporter that writes results to the console
  _jasmineConsoleReporter(jasmineEnv) {
    const failedSpecs = [];

    return {
      specDone(result) {
        if (result.status === 'passed' || result.status === 'failed') {
          // Open log group if failed
          const grouping = result.status === 'passed' ? '---' : '+++';
          const emoji = result.status === 'passed'
            ? ':green_heart:'
            : ':broken_heart:';
          console.log(`${grouping} ${emoji} ${result.fullName}`);
          this._results += `${grouping} ${result.fullName}\n`;

          if (result.status === 'failed') {
            result.failedExpectations.forEach(({ matcherName, message }) => {
              console.log(`${matcherName}: ${message}`);
              this._results += `${matcherName}: ${message}\n`;
            });
            failedSpecs.push(result);
          }
        }
      },

      suiteDone(result) {},

      jasmineStarted() {
        console.log('--- tests started');
      },

      jasmineDone() {
        console.log('--- tests done');
        console.log('--- send results to runner');
        let result = JSON.stringify({
          magic: '[TEST-SUITE-END]', // NOTE: Runner/Run.js waits to see this
          failed: failedSpecs.length,
          results: this._results,
        });
        console.log(result);

        if (ExponentTest) {
          ExponentTest.completed(result);
        }
      },
    };
  }

  // A jasmine reporter that writes results to this.state
  _jasmineSetStateReporter(jasmineEnv) {
    const app = this;
    return {
      suiteStarted(jasmineResult) {
        app.setState(({ state }) => ({
          state: state
            .updateIn(state.get('path'), children =>
              children.push(
                Immutable.fromJS({
                  result: jasmineResult,
                  children: [],
                  specs: [],
                })
              )
            )
            .update('path', path =>
              path.push(state.getIn(path).size, 'children')
            ),
        }));
      },

      suiteDone(jasmineResult) {
        app.setState(({ state }) => ({
          state: state
            .updateIn(state.get('path').pop().pop(), children =>
              children.update(children.size - 1, child =>
                child.set('result', child.get('result'))
              )
            )
            .update('path', path => path.pop().pop()),
        }));
      },

      specStarted(jasmineResult) {
        app.setState(({ state }) => ({
          state: state.updateIn(state.get('path').pop().pop(), children =>
            children.update(children.size - 1, child =>
              child.update('specs', specs =>
                specs.push(Immutable.fromJS(jasmineResult))
              )
            )
          ),
        }));
      },

      specDone(jasmineResult) {
        app.setState(({ state }) => ({
          state: state.updateIn(state.get('path').pop().pop(), children =>
            children.update(children.size - 1, child =>
              child.update('specs', specs =>
                specs.set(specs.size - 1, Immutable.fromJS(jasmineResult))
              )
            )
          ),
        }));
      },
    };
  }

  // --- Rendering -------------------------------------------------------------

  _renderSpecResult = r => {
    const status = r.get('status') || 'running';
    return (
      <View
        key={r.get('id')}
        style={{
          paddingLeft: 10,
          marginVertical: 3,
          borderColor: {
            running: '#ff0',
            passed: '#0f0',
            failed: '#f00',
            disabled: '#888',
          }[status],
          borderLeftWidth: 3,
        }}>
        <Text style={{ fontSize: 18 }}>
          {
            {
              running: '😮 ',
              passed: '😄 ',
              failed: '😞 ',
            }[status]
          }{r.get('description')} ({status})
        </Text>
        {r.get('failedExpectations').map((e, i) => (
          <Text key={i}>
            {e.get('message')}
          </Text>
        ))}
      </View>
    );
  };
  _renderSuiteResult = r => {
    return (
      <View
        key={r.get('result').get('id')}
        style={{
          paddingLeft: 10,
          borderColor: '#000',
          borderLeftWidth: 3,
        }}>
        <Text
          style={{
            fontSize: 20,
          }}>
          {r.get('result').get('description')}
        </Text>
        {r.get('specs').map(this._renderSpecResult)}
        {r.get('children').map(this._renderSuiteResult)}
      </View>
    );
  };
  _onScrollViewContentSizeChange = (contentWidth, contentHeight) => {
    if (this._scrollViewRef) {
      this._scrollViewRef.scrollTo({
        y: Math.max(0, contentHeight - Dimensions.get('window').height) +
          Expo.Constants.statusBarHeight,
      });
    }
  };
  render() {
    return (
      <View
        style={{
          flex: 1,
          marginTop: Expo.Constants.statusBarHeight || 18,
          alignItems: 'stretch',
          justifyContent: 'center',
        }}
        testID="test_suite_container">
        <ScrollView
          style={{
            flex: 1,
          }}
          contentContainerStyle={{
            padding: 5,
          }}
          ref={ref => this._scrollViewRef = ref}
          onContentSizeChange={this._onScrollViewContentSizeChange}>
          {this.state.state.get('suites').map(this._renderSuiteResult)}
        </ScrollView>
      </View>
    );
  }
}
Expo.registerRootComponent(App);
