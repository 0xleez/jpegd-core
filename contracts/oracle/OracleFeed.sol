// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "../interfaces/IAggregatorV3Interface.sol";

/**
 * @title OracleFeed
 */
contract OracleFeed is IAggregatorV3Interface, AccessControl {
    event AnswerUpdated(
        int256 indexed current,
        uint256 roundId,
        uint256 updatedAt
    );

    uint256 public constant version = 0;

    uint8 public override decimals;
    int256 public latestAnswer;
    uint256 public latestTimestamp;
    uint256 public latestRound;
    string public description;

    mapping(uint256 => int256) public getAnswer;
    mapping(uint256 => uint256) public getTimestamp;
    mapping(uint256 => uint256) private getStartedAt;

    constructor(
        uint8 _decimals,
        int256 _initialAnswer,
        string memory _description
    ) {
        decimals = _decimals;
        description = _description;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        updateAnswer(_initialAnswer);
    }

    function updateAnswer(int256 _answer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        latestAnswer = _answer;
        latestTimestamp = block.timestamp;
        latestRound++;
        getAnswer[latestRound] = _answer;
        getTimestamp[latestRound] = block.timestamp;
        getStartedAt[latestRound] = block.timestamp;
        emit AnswerUpdated(latestAnswer, latestRound, block.timestamp);
    }

    function updateRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _timestamp,
        uint256 _startedAt
    ) public {
        latestRound = _roundId;
        latestAnswer = _answer;
        latestTimestamp = _timestamp;
        getAnswer[latestRound] = _answer;
        getTimestamp[latestRound] = _timestamp;
        getStartedAt[latestRound] = _startedAt;
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            getAnswer[_roundId],
            getStartedAt[_roundId],
            getTimestamp[_roundId],
            _roundId
        );
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            uint80(latestRound),
            getAnswer[latestRound],
            getStartedAt[latestRound],
            getTimestamp[latestRound],
            uint80(latestRound)
        );
    }
}
